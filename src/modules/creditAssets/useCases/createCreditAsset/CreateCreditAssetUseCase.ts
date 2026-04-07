import { PrismaClient, CreditAsset, User } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { syncParticipantsAsUsers } from "../../../../utils/participantHelper";
import { ensureProcessFolderExists } from "../../../../utils/folderHelper";
import { AppError } from "../../../../errors/AppError";
import { LegalOneParticipant } from "../../../../services/legalOneTypes";

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

        const assetAlreadyExists = await prisma.creditAsset.findUnique({
            where: { legalOneId: assetData.legalOneId! },
        });
        if (assetAlreadyExists) throw new AppError(`Já existe um ativo com este ID Legal One.`, 409);

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

        // 1. Enriquecimento do ativo cadastrado (fire-and-forget)
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id).catch(err =>
            console.error(`[CreateAsset] Falha no enriquecimento do ativo ${newCreditAsset.id}:`, err.message)
        );

        // 2. Se for Recurso ou Incidente, garante que o processo pai (Lawsuit) existe
        if (
            (newCreditAsset.legalOneType === 'Appeal' || newCreditAsset.legalOneType === 'ProceduralIssue')
            && newCreditAsset.legalOneId
        ) {
            this.ensureParentLawsuit(newCreditAsset, investors, associateId || null).catch(err =>
                console.error(`[CreateAsset] Erro ao garantir processo pai:`, err)
            );
        }

        return newCreditAsset;
    }

    private async ensureParentLawsuit(child: CreditAsset, investors: InvestorInput[], associateId: string | null) {
        console.log(`[CreateAsset] 🔍 Buscando processo pai para o filho ID: ${child.legalOneId}`);

        let relatedLitigationId: number | null = null;

        try {
            if (child.legalOneType === 'Appeal') {
                const appealData = await legalOneApiService.getAppealById(child.legalOneId!);
                relatedLitigationId = appealData.relatedLitigationId || null;
            } else if (child.legalOneType === 'ProceduralIssue') {
                const issueData = await legalOneApiService.getProceduralIssueById(child.legalOneId!);
                relatedLitigationId = issueData.relatedLitigationId || null;
            }
        } catch (err: any) {
            console.error(`[CreateAsset] Falha ao buscar relatedLitigationId do filho ${child.legalOneId}:`, err.message);
            return;
        }

        if (!relatedLitigationId) {
            console.log(`[CreateAsset] ℹ️ Filho ${child.legalOneId} não possui processo pai vinculado.`);
            return;
        }

        // Verifica se o pai já existe no banco
        const parentExists = await prisma.creditAsset.findUnique({
            where: { legalOneId: relatedLitigationId }
        });

        if (parentExists) {
            console.log(`[CreateAsset] ✅ Processo pai ${relatedLitigationId} já está cadastrado. Pulando.`);
            return;
        }

        console.log(`[CreateAsset] ➡ Cadastrando processo pai (Lawsuit ID: ${relatedLitigationId})`);

        try {
            const parentData = await legalOneApiService.getLawsuitById(relatedLitigationId);

            const courtPanelDesc = parentData.courtPanel?.description || "Tribunal não identificado";
            const courtNumber = parentData.courtPanelNumberText || "";
            const origem = courtNumber ? `${courtNumber} ${courtPanelDesc}` : courtPanelDesc;

            const parentNumber = parentData.identifierNumber || String(relatedLitigationId);

            // getLawsuitById já inclui participants internamente
            const parentParticipants = parentData.participants || [];
            await syncParticipantsAsUsers(parentParticipants).catch(err =>
                console.error(`[CreateAsset] Erro ao sincronizar participantes do pai:`, err.message)
            );

            const customerP = parentParticipants.find((p: LegalOneParticipant) => p.type === "Customer");
            const otherPartyP = parentParticipants.find((p: LegalOneParticipant) => p.type === "OtherParty" && p.isMainParticipant)
                || parentParticipants.find((p: LegalOneParticipant) => p.type === "OtherParty");
            const parentOriginalCreditor = customerP?.contactName || child.originalCreditor;
            const parentOtherParty = otherPartyP?.contactName || child.otherParty;

            // Garante a pasta
            const folderCode = parentData.folder;
            const folderId = await ensureProcessFolderExists(folderCode, parentOtherParty).catch(err => {
                console.error(`[CreateAsset] Falha ao garantir pasta "${folderCode}", usando pasta do filho:`, err.message);
                return child.folderId;
            });

            const createdParent = await prisma.$transaction(async (tx) => {
                const asset = await tx.creditAsset.create({
                    data: {
                        processNumber: parentNumber,
                        originalCreditor: parentOriginalCreditor,
                        otherParty: parentOtherParty,
                        nickname: parentOtherParty,
                        origemProcesso: origem,
                        legalOneId: relatedLitigationId!,
                        legalOneType: 'Lawsuit',
                        folderId: folderId || child.folderId,
                        originalValue: 0,
                        acquisitionValue: 0,
                        currentValue: 0,
                        acquisitionDate: child.acquisitionDate,
                        updateIndexType: child.updateIndexType,
                        contractualIndexRate: child.contractualIndexRate,
                        status: 'PENDING_ENRICHMENT',
                        associateId: associateId,
                    }
                });

                if (investors.length > 0) {
                    const totalShare = investors.reduce((sum, i) => sum + (Number(i.share) || 0), 0);
                    const mazzotiniShare = 100 - totalShare;
                    await tx.investment.createMany({
                        data: investors.map((inv, idx) => ({
                            investorShare: inv.share || 0,
                            mazzotiniShare: idx === 0 ? mazzotiniShare : 0,
                            userId: inv.userId,
                            creditAssetId: asset.id,
                            associateId: inv.associateId || undefined,
                            acquisitionDate: inv.acquisitionDate || undefined
                        }))
                    });
                }
                return asset;
            });

            console.log(`[CreateAsset] ✅ Processo pai ${parentNumber} cadastrado com sucesso (ID: ${createdParent.id})`);

            // Enriquece o pai também (fire-and-forget)
            const enrichParent = new EnrichAssetFromLegalOneUseCase();
            enrichParent.execute(createdParent.id).catch(err =>
                console.error(`[CreateAsset] Falha no enriquecimento do processo pai ${createdParent.id}:`, err.message)
            );

        } catch (err: any) {
            console.error(`[CreateAsset] ❌ Falha ao cadastrar processo pai ${relatedLitigationId}:`, err.message);
        }
    }
}

export { CreateCreditAssetUseCase };
