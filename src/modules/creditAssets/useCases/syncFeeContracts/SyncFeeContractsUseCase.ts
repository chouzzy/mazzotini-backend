import { prisma } from '../../../../prisma';
import { legalOneApiService } from '../../../../services/legalOneApiService';

const TYPE_TO_CATEGORY: Record<string, string> = {
    'cessao':                'CESSAO',
    'cessão':                'CESSAO',
    'honorarios':            'HONORARIOS',
    'honorários':            'HONORARIOS',
    'orientacao financeira': 'ORIENTACAO_FINANCEIRA',
    'orientação financeira': 'ORIENTACAO_FINANCEIRA',
    'orientacao fiscal':     'ORIENTACAO_FISCAL',
    'orientação fiscal':     'ORIENTACAO_FISCAL',
    'nota fiscal':           'NOTA_FISCAL',
    'comprovante':           'COMPROVANTE',
};

function mapTypeToCategory(type: string | null | undefined): string | null {
    if (!type) return null;
    const key = type.replace(/^#/, '').toLowerCase().trim();
    return TYPE_TO_CATEGORY[key] ?? null;
}

function extractFolderNumber(folder: string): string | null {
    const match = folder.match(/(\d{7})/);
    return match ? match[1] : null;
}

function maskDocument(raw: string): string {
    if (raw.length === 11)
        return `${raw.slice(0,3)}.${raw.slice(3,6)}.${raw.slice(6,9)}-${raw.slice(9)}`;
    if (raw.length === 14)
        return `${raw.slice(0,2)}.${raw.slice(2,5)}.${raw.slice(5,8)}/${raw.slice(8,12)}-${raw.slice(12)}`;
    return raw;
}

export interface SyncFeeContractsResult {
    documentsImported: number;
    documentsSkipped: number;
    errors: string[];
}

export class SyncFeeContractsUseCase {
    async execute(): Promise<SyncFeeContractsResult> {
        const result: SyncFeeContractsResult = {
            documentsImported: 0,
            documentsSkipped: 0,
            errors: [],
        };

        // Busca todos os docs com type '#...' vinculados a Contrato de Honorários
        const docs = await legalOneApiService.getPrivateDocuments();
        console.log(`[SyncFeeContracts] ${docs.length} documentos privados encontrados`);

        for (const doc of docs) {
            try {
                const imported = await this.processDocument(doc);
                if (imported) result.documentsImported++;
                else result.documentsSkipped++;
            } catch (err: any) {
                const msg = `Doc ${doc.id}: ${err.message}`;
                console.error(`[SyncFeeContracts] ERRO — ${msg}`);
                result.errors.push(msg);
            }
        }

        return result;
    }

    private async processDocument(doc: any): Promise<boolean> {
        // Idempotência
        if (doc.id) {
            const existing = await prisma.document.findFirst({ where: { legalOneDocumentId: doc.id } });
            if (existing) return false;
        }

        const category = mapTypeToCategory(doc.type);
        if (!category) return false;

        const rels: any[] = doc.relationships || [];

        // Vínculo Contract → pasta → processo
        const contractRel = rels.find((r: any) => r.link === 'Contract');
        const folderDesc: string | null = contractRel?.linkItem?.description ?? null;
        const contractId: number | null = contractRel?.linkItem?.id ?? null;

        // Vínculo Contact → contactId → CPF → usuário
        const contactRel = rels.find((r: any) => r.link === 'Contact');
        const contactId: number | null = contactRel?.linkItem?.id ?? null;
        if (!contactId) return false;

        const rawDoc = await legalOneApiService.getContactIdentification(contactId);
        if (!rawDoc) return false;

        const masked = maskDocument(rawDoc);
        const investorUser = await prisma.user.findFirst({
            where: { OR: [{ cpfOrCnpj: rawDoc }, { cpfOrCnpj: masked }] },
            select: { id: true },
        });
        if (!investorUser) return false;

        // Encontra o processo pela pasta (opcional — assetId pode ficar null)
        const folderNumber = folderDesc ? extractFolderNumber(folderDesc) : null;
        let assetId: string | null = null;
        if (folderNumber) {
            const processFolder = await prisma.processFolder.findFirst({
                where: { folderCode: { contains: folderNumber } },
                include: { assets: { where: { legalOneType: 'Lawsuit' }, take: 1 } },
            });
            assetId = processFolder?.assets[0]?.id ?? null;
        }

        const downloadUrl = await legalOneApiService.getDocumentDownloadUrl(doc.id).catch(() => '');

        await prisma.document.create({
            data: {
                name: doc.archive || doc.description || `Documento ${doc.id}`,
                url: downloadUrl,
                section: 'PRIVADO_FINANCEIRO',
                category,
                sourceType: 'LEGAL_ONE',
                investorUserId: investorUser.id,
                assetId,
                legalOneDocumentId: doc.id,
                legalOneServiceId: contractId,
            },
        });

        return true;
    }
}
