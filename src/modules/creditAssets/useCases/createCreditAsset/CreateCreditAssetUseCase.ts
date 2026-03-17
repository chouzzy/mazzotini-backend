import { PrismaClient, CreditAsset, User } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

interface InvestorInput {
    userId: User['id'];
    share?: number;
    associateId?: string | null;
    acquisitionDate?: Date | null;
}

type ICreateCreditAssetDTO = Pick<CreditAsset, 'processNumber' | 'originalCreditor' | 'origemProcesso' | 'legalOneId' | 'legalOneType' | 'originalValue' | 'acquisitionValue' | 'acquisitionDate' | 'updateIndexType' | 'contractualIndexRate' | 'nickname' | 'otherParty' | 'folderId'> & {
    investors: InvestorInput[];
    associateId?: User['id'] | null;
};

class CreateCreditAssetUseCase {
    async execute(data: ICreateCreditAssetDTO): Promise<CreditAsset> {
        const { processNumber, investors, associateId, ...assetData } = data;

        const assetAlreadyExists = await prisma.creditAsset.findFirst({
            where: { OR: [{ processNumber }, { legalOneId: assetData.legalOneId }] },
        });
        if (assetAlreadyExists) throw new Error(`Já existe um ativo com este número ou ID Legal One.`);

        const totalShare = investors.reduce((sum, i) => sum + (Number(i.share) || 0), 0);
        const mazzotiniShare = 100 - totalShare;

        const newCreditAsset = await prisma.$transaction(async (tx) => {
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData,
                    processNumber,
                    status: 'PENDING_ENRICHMENT',
                    currentValue: assetData.originalValue,
                    associateId: associateId || null,
                },
            });

            if (investors.length > 0) {
                await tx.investment.createMany({
                    data: investors.map((inv, idx) => ({
                        investorShare: inv.share || 0,
                        mazzotiniShare: idx === 0 ? mazzotiniShare : 0,
                        userId: inv.userId,
                        creditAssetId: createdAsset.id,
                        associateId: inv.associateId || undefined,
                        acquisitionDate: inv.acquisitionDate || undefined
                    }))
                });
            }
            return createdAsset;
        });

        // 1. Enriquecimento do pai
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id).catch(console.error);

        // 2. DISPARO DA AUTOMAÇÃO DE FILHOS
        if (newCreditAsset.legalOneType === 'Lawsuit' && newCreditAsset.legalOneId) {
            this.syncChildren(newCreditAsset, investors, associateId || null).catch(err =>
                console.error(`[CreateAsset] Erro na sincronização de filhos:`, err)
            );
        }

        return newCreditAsset;
    }

    private async syncChildren(parent: CreditAsset, investors: InvestorInput[], associateId: string | null) {
        console.log(`[CreateAsset] 🕵️ Buscando família do processo pai ID: ${parent.legalOneId}`);

        const [appeals, issues] = await Promise.all([
            legalOneApiService.getAppealsByLawsuitId(parent.legalOneId!),
            legalOneApiService.getProceduralIssuesByLawsuitId(parent.legalOneId!)
        ]);

        const children = [
            ...appeals.map(a => ({ ...a, type: 'Appeal' })),
            ...issues.map(i => ({ ...i, type: 'ProceduralIssue' }))
        ];

        console.log(`[CreateAsset] ℹ️ Total de potenciais filhos encontrados: ${children.length}`);

        for (const child of children) {
            // Se vier identifierNumber (com máscara), usamos ele. Senão, usamos o oldNumber.
            const childNumber = child.identifierNumber || child.oldNumber;

            if (!childNumber) {
                console.warn(`[CreateAsset] Filho ID ${child.id} ignorado por falta de número identificador.`);
                continue;
            }

            try {
                // Verificação de duplicidade por Número de Processo
                const exists = await prisma.creditAsset.findUnique({ where: { processNumber: childNumber } });
                if (exists) {
                    console.log(`[CreateAsset] ⏩ Filho ${childNumber} já cadastrado no sistema. Pulando.`);
                    continue;
                }

                console.log(`[CreateAsset] ➡ Cadastrando Filho: ${childNumber} (${child.type})`);

                const courtPanelDesc = (child as any).courtPanel?.description || "Tribunal não identificado";
                const courtNumber = (child as any).courtPanelNumberText || "";
                const origem = courtNumber ? `${courtNumber} ${courtPanelDesc}` : courtPanelDesc;

                const createdChild = await prisma.$transaction(async (tx) => {
                    const asset = await tx.creditAsset.create({
                        data: {
                            processNumber: childNumber,
                            originalCreditor: parent.originalCreditor,
                            otherParty: parent.otherParty,
                            nickname: parent.nickname,
                            origemProcesso: origem,
                            legalOneId: child.id,
                            legalOneType: child.type as any,
                            folderId: parent.folderId,
                            originalValue: 0,
                            acquisitionValue: 0,
                            currentValue: 0,
                            acquisitionDate: parent.acquisitionDate,
                            updateIndexType: parent.updateIndexType,
                            contractualIndexRate: parent.contractualIndexRate,
                            status: 'PENDING_ENRICHMENT',
                            associateId: associateId,
                        }
                    });

                    if (investors.length > 0) {
                        await tx.investment.createMany({
                            data: investors.map((inv) => ({
                                investorShare: inv.share || 0,
                                mazzotiniShare: 0,
                                userId: inv.userId,
                                creditAssetId: asset.id,
                                associateId: inv.associateId || undefined,
                                acquisitionDate: inv.acquisitionDate || undefined
                            }))
                        });
                    }
                    return asset;
                });

                // Dispara o enriquecimento do filho e aguarda (para logar erros aqui mesmo)
                const enrichChild = new EnrichAssetFromLegalOneUseCase();
                await enrichChild.execute(createdChild.id);

            } catch (err: any) {
                // Erro num filho não deve impedir o cadastro dos outros!
                console.error(`[CreateAsset] ❌ Falha ao processar filho ${childNumber}:`, err.message);
            }
        }
        console.log(`[CreateAsset] ✅ Sincronização da família finalizada.`);
    }
}

export { CreateCreditAssetUseCase };