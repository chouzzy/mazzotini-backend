import { prisma } from '../../../../prisma';
import { legalOneApiService } from '../../../../services/legalOneApiService';
import { unmask } from '../../../../utils/masks';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Throttle: 1.2s entre ativos, 400ms entre contatos dentro do mesmo ativo
const DELAY_BETWEEN_ASSETS_MS = 1200;
const DELAY_BETWEEN_CONTACTS_MS = 400;

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 429 && attempt < maxRetries) {
                // Exponencial: 5s, 10s, 20s
                const waitMs = Math.pow(2, attempt) * 5000;
                console.warn(`[BACKFILL] 429 em "${label}". Aguardando ${waitMs / 1000}s (retry ${attempt + 1}/${maxRetries})...`);
                await sleep(waitMs);
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Max retries excedido para: ${label}`);
}

const ENDPOINT_MAP: Record<string, 'lawsuits' | 'appeals' | 'proceduralissues'> = {
    Lawsuit: 'lawsuits',
    Appeal: 'appeals',
    ProceduralIssue: 'proceduralissues',
};

export interface BackfillResult {
    totalAssets: number;
    processed: number;
    linked: number;
    alreadyLinked: number;
    skipped: number;
    errors: { assetId: string; processNumber: string; error: string }[];
}

class BackfillInvestorsUseCase {
    async execute(): Promise<BackfillResult> {
        const result: BackfillResult = {
            totalAssets: 0,
            processed: 0,
            linked: 0,
            alreadyLinked: 0,
            skipped: 0,
            errors: [],
        };

        const assets = await prisma.creditAsset.findMany({
            select: { id: true, legalOneId: true, legalOneType: true, processNumber: true },
        });

        result.totalAssets = assets.length;
        console.log(`[BACKFILL] Iniciando backfill de ${assets.length} ativo(s)...`);

        for (const asset of assets) {
            const endpointType = asset.legalOneType ? ENDPOINT_MAP[asset.legalOneType] : null;

            if (!asset.legalOneId || !endpointType) {
                result.skipped++;
                continue;
            }

            try {
                const participants = await withRetry(
                    () => legalOneApiService.getEntityParticipants(endpointType, asset.legalOneId!),
                    `participants(${asset.legalOneId})`
                );

                const customers = participants.filter(p => p.type === 'Customer');

                if (customers.length === 0) {
                    result.skipped++;
                    await sleep(DELAY_BETWEEN_ASSETS_MS);
                    continue;
                }

                console.log(`[BACKFILL] ${asset.processNumber}: ${customers.length} cliente(s) encontrado(s).`);

                for (const customer of customers) {
                    await sleep(DELAY_BETWEEN_CONTACTS_MS);

                    try {
                        const cpfFromApi = await withRetry(
                            () => legalOneApiService.getContactIdentification(customer.contactId),
                            `cpf(${customer.contactId})`
                        );

                        if (!cpfFromApi) {
                            console.log(`[BACKFILL] Contato ${customer.contactId} sem CPF/CNPJ. Pulando.`);
                            continue;
                        }

                        const cpfUnmasked = unmask(cpfFromApi);
                        if (!cpfUnmasked) continue;

                        // Busca usuário REAL (exclui shadow users criados pela importação)
                        const user = await prisma.user.findFirst({
                            where: {
                                OR: [
                                    { cpfOrCnpj: cpfUnmasked },
                                    { cpfOrCnpj: cpfFromApi },
                                ],
                                NOT: { auth0UserId: { startsWith: 'legalone|import|' } },
                            },
                            select: { id: true, name: true },
                        });

                        if (!user) {
                            console.log(`[BACKFILL] Nenhum usuário real com CPF ***${cpfUnmasked.slice(-4)}. Pulando.`);
                            continue;
                        }

                        const existing = await prisma.investment.findFirst({
                            where: { userId: user.id, creditAssetId: asset.id },
                        });

                        if (existing) {
                            result.alreadyLinked++;
                            continue;
                        }

                        await prisma.investment.create({
                            data: {
                                userId: user.id,
                                creditAssetId: asset.id,
                                investorShare: 0,
                                mazzotiniShare: 0,
                            },
                        });

                        console.log(`[BACKFILL] ✅ ${user.name} → ${asset.processNumber}`);
                        result.linked++;

                    } catch (contactErr: any) {
                        console.error(`[BACKFILL] Erro no contato ${customer.contactId}:`, contactErr.message);
                    }
                }

                result.processed++;

            } catch (err: any) {
                console.error(`[BACKFILL] Ativo ${asset.processNumber} falhou:`, err.message);
                result.errors.push({
                    assetId: asset.id,
                    processNumber: asset.processNumber,
                    error: err.message,
                });
            }

            await sleep(DELAY_BETWEEN_ASSETS_MS);
        }

        console.log(
            `[BACKFILL] Concluído — Total: ${result.totalAssets} | Processados: ${result.processed} | ` +
            `Vinculados: ${result.linked} | Já vinculados: ${result.alreadyLinked} | ` +
            `Pulados: ${result.skipped} | Erros: ${result.errors.length}`
        );

        return result;
    }
}

export { BackfillInvestorsUseCase };
