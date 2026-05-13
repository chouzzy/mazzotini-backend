import cron from 'node-cron';
import { SyncProcessUpdatesUseCase } from './modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase';
import { ImportNewAssetsUseCase } from './modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase';
import { prisma } from './prisma';
import { fetchIndexSeries, fetchTJSPSeries } from './services/ibgeService';
import { calculateJudicialDebt, CalculationParams, Installment } from './services/judicialCalculatorService';

const syncUseCase = new SyncProcessUpdatesUseCase();
const importUseCase = new ImportNewAssetsUseCase();

/**
 * Inicia todos os jobs agendados da aplicação.
 */
export const startScheduledJobs = () => {
    console.log("⏰ Agendador de tarefas iniciado.");

    // Todos os dias à meia-noite: importa processos novos cadastrados no Legal One
    // nas últimas 48h (janela de 2 dias para cobrir eventuais atrasos de cadastro).
    cron.schedule('0 0 * * *', () => {
        console.log('--- Executando job agendado: Importar Novos Processos do Legal One ---');
        const since = new Date();
        since.setDate(since.getDate() - 2); // últimas 48h
        since.setHours(0, 0, 0, 0);
        importUseCase.execute(since);
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todos os dias à 1h da manhã: sincroniza andamentos dos processos ativos.
    cron.schedule('0 1 * * *', () => {
        console.log('--- Executando job agendado: Sincronizar Andamentos ---');
        syncUseCase.execute();
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todo dia 5 de cada mês às 04h: atualiza índices do IBGE e recalcula processos.
    cron.schedule('0 4 5 * *', async () => {
        console.log('--- Executando job agendado: Atualizar Índices e Recalcular Processos ---');
        const now = new Date();
        const year  = now.getFullYear();
        const month = now.getMonth() + 1;

        try {
            // 1. Atualiza índices do mês corrente via IBGE
            const indexesToUpdate = [
                { name: 'IPCA15', fetcher: () => fetchIndexSeries('IPCA15', year, month, year, month) },
                { name: 'IPCA_E', fetcher: () => fetchIndexSeries('IPCA_E', year, month, year, month) },
                { name: 'INPC',   fetcher: () => fetchIndexSeries('INPC',   year, month, year, month) },
                { name: 'IPCA',   fetcher: () => fetchIndexSeries('IPCA',   year, month, year, month) },
                { name: 'TJSP_LEI14905', fetcher: () => fetchTJSPSeries(year, month, year, month) },
            ];

            for (const idx of indexesToUpdate) {
                try {
                    const points = await idx.fetcher();
                    for (const p of points) {
                        await prisma.indexSeries.upsert({
                            where:  { indexName_year_month: { indexName: idx.name, year: p.year, month: p.month } },
                            create: { indexName: idx.name, year: p.year, month: p.month, monthlyRate: p.monthlyRate },
                            update: { monthlyRate: p.monthlyRate },
                        });
                    }
                    console.log(`  Índice ${idx.name} atualizado: ${points.length} meses`);
                } catch (e: any) {
                    console.error(`  Erro ao atualizar ${idx.name}:`, e.message);
                }
            }

            // 2. Recalcula todos os processos com parâmetros configurados
            const allParams = await prisma.processCalculationParams.findMany();
            let ok = 0, fail = 0;

            for (const params of allParams) {
                try {
                    const result = await calculateJudicialDebt(
                        {
                            correctionIndex:    params.correctionIndex,
                            moratoryRate:       params.moratoryRate,
                            moratoryType:       params.moratoryType,
                            moratoryStartDate:  params.moratoryStartDate?.toISOString() ?? null,
                            compensatoryRate:   params.compensatoryRate,
                            compensatoryType:   params.compensatoryType,
                            feesPercentage:     params.feesPercentage,
                            penaltyPercentage:  params.penaltyPercentage,
                            feesOnPenalty:      params.feesOnPenalty,
                            installments:       params.installments as unknown as Installment[],
                        } as CalculationParams,
                        year,
                        month,
                    );

                    await prisma.calculationLog.create({
                        data: {
                            assetId:              params.assetId,
                            calculatedBy:         'cron',
                            referenceMonth:       month,
                            referenceYear:        year,
                            baseTotal:            result.baseTotal,
                            correctedValue:       result.correctedValue,
                            moratoryInterest:     result.moratoryInterest,
                            compensatoryInterest: result.compensatoryInterest,
                            feesValue:            result.feesValue,
                            penaltyValue:         result.penaltyValue,
                            totalValue:           result.totalValue,
                            breakdown:            result.installmentResults as any,
                        },
                    });

                    await prisma.processCalculationParams.update({
                        where: { id: params.id },
                        data:  { lastCalculatedValue: result.totalValue, lastCalculatedAt: new Date() },
                    });

                    await prisma.creditAsset.update({
                        where: { id: params.assetId },
                        data:  { currentValue: result.totalValue },
                    });

                    ok++;
                } catch (e: any) {
                    console.error(`  Erro ao recalcular processo ${params.assetId}:`, e.message);
                    fail++;
                }
            }

            console.log(`  Recálculo concluído: ${ok} sucesso, ${fail} falhas`);
        } catch (e: any) {
            console.error('  Erro crítico no job de índices/recálculo:', e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });

};

