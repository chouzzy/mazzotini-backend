import { prisma } from '../../../../prisma';
import { legalOneApiService } from '../../../../services/legalOneApiService';
import { unmask } from '../../../../utils/masks';
import { resetBackfillState, updateBackfillState } from './backfillState';

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
            const retryAfter = err?.response?.headers?.['retry-after'];
            if (status === 429 && attempt < maxRetries) {
                // Usa Retry-After se disponível; caso contrário exponencial longo: 30s, 60s, 120s
                const waitMs = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : Math.pow(2, attempt) * 30000;
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
    async execute(processNumbers?: string[]): Promise<BackfillResult> {
        const result: BackfillResult = {
            totalAssets: 0,
            processed: 0,
            linked: 0,
            alreadyLinked: 0,
            skipped: 0,
            errors: [],
        };

        const assets = await prisma.creditAsset.findMany({
            where: processNumbers?.length
                ? { processNumber: { in: processNumbers } }
                : undefined,
            select: { id: true, legalOneId: true, legalOneType: true, processNumber: true },
        });

        result.totalAssets = assets.length;
        resetBackfillState(assets.length);
        const label = processNumbers?.length ? `${assets.length} ativo(s) específico(s)` : `${assets.length} ativo(s)`;
        console.log(`[BACKFILL] Iniciando backfill de ${label}...`);

        for (const asset of assets) {
            updateBackfillState({ currentProcess: asset.processNumber });
            const endpointType = asset.legalOneType ? ENDPOINT_MAP[asset.legalOneType] : null;

            if (!asset.legalOneId || !endpointType) {
                result.skipped++;
                updateBackfillState({ skipped: result.skipped, processed: result.processed });
                continue;
            }

            try {
                const participants = await withRetry(
                    () => legalOneApiService.getEntityParticipants(endpointType, asset.legalOneId!),
                    `participants(${asset.legalOneId})`
                );

                // Todos os participantes são candidatos — o CPF no nosso DB é o único filtro de segurança.
                // Usar apenas 'Customer' excluía posições como 'Cessionário' (type='Party' ou 'Other').
                const customers = participants;
                const typesSummary = participants.map(p => `${p.contactName || p.contactId}(${p.type})`).join(', ');

                if (customers.length === 0) {
                    result.skipped++;
                    updateBackfillState({ skipped: result.skipped });
                    await sleep(DELAY_BETWEEN_ASSETS_MS);
                    continue;
                }

                console.log(`[BACKFILL] ${asset.processNumber}: ${customers.length} participante(s) — ${typesSummary}`);

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
                        updateBackfillState({ linked: result.linked });

                    } catch (contactErr: any) {
                        console.error(`[BACKFILL] Erro no contato ${customer.contactId}:`, contactErr.message);
                    }
                }

                result.processed++;
                updateBackfillState({ processed: result.processed, alreadyLinked: result.alreadyLinked });

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

        updateBackfillState({
            status: 'completed',
            finishedAt: new Date().toISOString(),
            currentProcess: null,
            errors: result.errors.length,
        });

        console.log(
            `[BACKFILL] Concluído — Total: ${result.totalAssets} | Processados: ${result.processed} | ` +
            `Vinculados: ${result.linked} | Já vinculados: ${result.alreadyLinked} | ` +
            `Pulados: ${result.skipped} | Erros: ${result.errors.length}`
        );

        return result;
    }
}

export { BackfillInvestorsUseCase };
