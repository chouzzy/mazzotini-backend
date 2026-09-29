import { prisma } from '../../../../prisma';
import {
    EnrichAssetFromLegalOneUseCase,
    MAX_ENRICHMENT_ATTEMPTS,
} from '../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Espaçamento entre ativos para não estourar a quota do Legal One. */
const DELAY_BETWEEN_ASSETS_MS = 1500;

/** Só retenta um ativo que não é tocado há pelo menos 6h. */
const COOLDOWN_HOURS = 6;

/** Teto por execução — evita queimar a quota diária inteira numa varredura só. */
const MAX_ASSETS_PER_RUN = 100;

/**
 * Falhas seguidas que fazem a varredura abortar.
 *
 * Se vários ativos falham em sequência, o problema não é deles — é da API do
 * Legal One (quota estourada) ou do nosso código. Continuar só incrementaria
 * `enrichmentAttempts` da fila inteira até todos baterem o teto e saírem do
 * reprocessamento automático, transformando um problema temporário em permanente.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

export interface RetryEnrichmentResult {
    candidates: number;
    recovered: number;
    stillFailing: number;
    exhausted: number;
    abortedEarly: boolean;
}

/**
 * Reprocessa ativos travados em FAILED_ENRICHMENT / PENDING_ENRICHMENT.
 *
 * Existe porque o enriquecimento só rodava uma vez, fire-and-forget, na criação
 * do ativo: qualquer erro (inclusive um 429 de quota) deixava o processo parado
 * para sempre, já que o sync diário filtra apenas `status: 'Ativo'`.
 */
class RetryFailedEnrichmentsUseCase {
    async execute(): Promise<RetryEnrichmentResult> {
        const result: RetryEnrichmentResult = {
            candidates: 0,
            recovered: 0,
            stillFailing: 0,
            exhausted: 0,
            abortedEarly: false,
        };

        const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

        const candidates = await prisma.creditAsset.findMany({
            where: {
                status: { in: ['FAILED_ENRICHMENT', 'PENDING_ENRICHMENT'] },
                // Ainda tem tentativa sobrando. `null` cobre os ativos anteriores
                // a este campo, que nunca foram contabilizados.
                OR: [
                    { enrichmentAttempts: null },
                    { enrichmentAttempts: { lt: MAX_ENRICHMENT_ATTEMPTS } },
                ],
                // Respeita o cooldown; `null` = nunca tentado desde a mudança.
                AND: [
                    {
                        OR: [
                            { lastEnrichmentAt: null },
                            { lastEnrichmentAt: { lt: cooldownCutoff } },
                        ],
                    },
                ],
            },
            select: { id: true, processNumber: true },
            // asc coloca os nulos primeiro: quem nunca foi tentado tem prioridade.
            orderBy: { lastEnrichmentAt: 'asc' },
            take: MAX_ASSETS_PER_RUN,
        });

        result.candidates = candidates.length;
        if (candidates.length === 0) {
            console.log('[RetryEnrich] Nenhum ativo travado para reprocessar.');
            return result;
        }

        console.log(`[RetryEnrich] Reprocessando ${candidates.length} ativo(s) travado(s)...`);

        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        let consecutiveFailures = 0;

        for (const asset of candidates) {
            try {
                await enrichUseCase.execute(asset.id);

                // O UseCase não devolve status; relê para saber se recuperou.
                const after = await prisma.creditAsset.findUnique({
                    where: { id: asset.id },
                    select: { status: true, enrichmentAttempts: true },
                });

                if (after?.status === 'Ativo') {
                    result.recovered++;
                    consecutiveFailures = 0;
                    console.log(`[RetryEnrich] ✅ ${asset.processNumber} recuperado.`);
                } else {
                    consecutiveFailures++;
                    if ((after?.enrichmentAttempts ?? 0) >= MAX_ENRICHMENT_ATTEMPTS) {
                        result.exhausted++;
                    } else {
                        result.stillFailing++;
                    }
                }
            } catch (err: any) {
                // Defeito de código é propagado pelo UseCase sem tocar no status.
                // Abortar na hora evita percorrer a fila inteira com o mesmo bug.
                consecutiveFailures++;
                result.stillFailing++;
                console.error(`[RetryEnrich] Erro em ${asset.processNumber}:`, err.message);
            }

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                result.abortedEarly = true;
                console.error(
                    `[RetryEnrich] ⛔ ${consecutiveFailures} falhas seguidas — varredura abortada. ` +
                    `O problema é sistêmico (quota do Legal One ou bug), não dos ativos. ` +
                    `Interrompendo para não esgotar as tentativas da fila inteira.`
                );
                break;
            }

            await sleep(DELAY_BETWEEN_ASSETS_MS);
        }

        console.log(
            `[RetryEnrich] ${result.abortedEarly ? 'ABORTADO' : 'Concluído'} — ` +
            `Candidatos: ${result.candidates} | Recuperados: ${result.recovered} | ` +
            `Ainda falhando: ${result.stillFailing} | Esgotados: ${result.exhausted}`
        );

        return result;
    }
}

export { RetryFailedEnrichmentsUseCase };
