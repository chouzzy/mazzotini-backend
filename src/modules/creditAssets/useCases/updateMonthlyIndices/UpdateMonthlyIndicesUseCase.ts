// src/modules/creditAssets/useCases/updateMonthlyIndices/UpdateMonthlyIndicesUseCase.ts
import { PrismaClient } from "@prisma/client";
import axios from 'axios'; 
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ============================================================================
//  LÓGICA DO "OLHEIRO" (Usando a API correta - SGS 11)
// ============================================================================

const sgsSeriesIds = {
    'SELIC': 11,    // Taxa SELIC diária (Ex: 0.055131)
    'IPCA': 433,  // Variação mensal (Ex: 0.50)
    'IGP-M': 189, // Variação mensal (Ex: 0.30)
    'CDI': 12,    // Taxa DI over 252 (Ex: 14.89)
};
type IndexType = 'SELIC' | 'IPCA' | 'CDI' | 'IGP-M' | 'Outro';
interface MonthlyIndexData {
    date: Date;
    value: number; 
    type: 'monthly' | 'annualized' | 'daily';
}
const formatDateToBCB = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};
const parseBCBDate = (dateString: string): Date => {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
};
const getMonthlyIndexSeries = async (
    indexType: IndexType,
    startDate: Date,
    endDate: Date
): Promise<MonthlyIndexData[]> => {
    const seriesId = sgsSeriesIds[indexType as keyof typeof sgsSeriesIds];
    if (!seriesId) {
        console.warn(`[EconomicIndexService_LOCAL] Índice ${indexType} não mapeado. Retornando série vazia.`);
        return [];
    }
    let seriesType: 'monthly' | 'annualized' | 'daily' = 'monthly';
    if (indexType === 'CDI') seriesType = 'annualized';
    if (indexType === 'SELIC') seriesType = 'daily'; 

    console.log(`[EconomicIndexService_LOCAL] Buscando série ${indexType} (SGS: ${seriesId}, Tipo: ${seriesType}) de ${formatDateToBCB(startDate)} até ${formatDateToBCB(endDate)}`);
    
    const startDateStr = formatDateToBCB(startDate);
    const endDateStr = formatDateToBCB(endDate);
    const bcbApiUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;
    try {
        const response = await axios.get<{ data: string, valor: string }[]>(bcbApiUrl);
        const data = response.data;
        if (!data || data.length === 0) {
            console.warn(`[EconomicIndexService_LOCAL] Nenhum dado retornado pelo BCB para ${indexType} no período.`);
            return [];
        }
        const seriesData = data.map(entry => ({
            date: parseBCBDate(entry.data),
            value: parseFloat(entry.valor.replace(',', '.')),
            type: seriesType, 
        }));
        console.log(`[EconomicIndexService_LOCAL] Série histórica ${indexType} (${seriesType}) com ${seriesData.length} entradas encontrada.`);
        return seriesData;
    } catch (error: any) {
        console.error(`[EconomicIndexService_LOCAL] Erro ao buscar dados do BCB para ${indexType} (Série: ${seriesId}):`, error.response?.data || error.message);
        return []; 
    }
};

// ============================================================================
//  FIM DA LÓGICA MOVIDA
// ============================================================================


const formatAsISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
}

class UpdateMonthlyIndicesUseCase {

    async execute(): Promise<void> {
        console.log(`[Cron:UpdateIndices_V4_FIXED] Iniciando tarefa de atualização monetária mensal...`);

        const today = new Date();
        const firstDayOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startDate = new Date(firstDayOfThisMonth);
        startDate.setMonth(startDate.getMonth() - 1); 
        const endDate = new Date(firstDayOfThisMonth);
        endDate.setDate(endDate.getDate() - 1); 

        console.log(`[Cron:UpdateIndices_V4_FIXED] Período de cálculo: ${formatAsISO(startDate)} a ${formatAsISO(endDate)}`);

        const assetsToUpdate = await prisma.creditAsset.findMany({
            where: {
                status: 'Ativo', 
                NOT: { updateIndexType: null },
                AND: { NOT: { updateIndexType: 'Outro' } }
            }
        });

        if (assetsToUpdate.length === 0) {
            console.log("[Cron:UpdateIndices_V4_FIXED] Nenhum ativo 'Ativo' com índice para atualizar.");
            return;
        }

        console.log(`[Cron:UpdateIndices_V4_FIXED] ${assetsToUpdate.length} ativos encontrados para atualização.`);

        const indexTypes = [...new Set(assetsToUpdate.map(a => a.updateIndexType! as any))];
        const indexFactors = new Map<string, number>();

        await Promise.all(indexTypes.map(async (indexType) => {
            const factors = await getMonthlyIndexSeries(indexType, startDate, endDate); 
            let monthFactor = 1.0; 
            
            if (factors.length > 0) {
                const type = factors[0].type;
                if (type === 'annualized') {
                    monthFactor = Math.pow(1 + (factors[0].value / 100), 1/12);
                } else if (type === 'daily') {
                    monthFactor = factors.reduce((acc, entry) => {
                        const dailyFactor = 1 + (entry.value / 100);
                        return acc * dailyFactor;
                    }, 1.0); 
                } else {
                    monthFactor = 1 + (factors[0].value / 100);
                }
            } else {
                 console.warn(`[Cron:UpdateIndices_V4_FIXED] Não foi encontrado valor do ${indexType} para ${formatAsISO(startDate)}. Usando 0% (fator 1.0).`);
            }
            indexFactors.set(indexType, monthFactor);
            console.log(`[Cron:UpdateIndices_V4_FIXED] Fator ${indexType} para o mês: ${monthFactor}`);
        }));

        for (const asset of assetsToUpdate) {
            try {
                const bcbFactor = indexFactors.get(asset.updateIndexType!) || 1.0;
                const contractualRateMonthly = (asset.contractualIndexRate || 0) / 100; 
                const currentValue = asset.currentValue;
                const newValue = currentValue * bcbFactor * (1 + contractualRateMonthly);
                const description = `Correção automática: ${asset.updateIndexType} (${((bcbFactor - 1) * 100).toFixed(4)}%) + Taxa (${(contractualRateMonthly * 100).toFixed(2)}%)`;
                console.log(       ((): number => {
                                const g = global as any;
                                g.__legalOneUpdateCounter = (g.__legalOneUpdateCounter || 0) + 1;
                                // timestamp em micros + contador, negativo para sinalizar "interno"
                                return -(Date.now() * 1000 + g.__legalOneUpdateCounter);
                            })(),)
                await prisma.$transaction(async (tx) => {
                    // 5.1. Salva o novo Andamento
                    await tx.assetUpdate.create({
                        data: {
                            assetId: asset.id,
                            // =================================================================
                            //  A CORREÇÃO (Bug do Unique constraint)
                            //  Usamos um timestamp negativo como ID único "interno",
                            //  baseado na sua excelente ideia.
                            //  Garante unicidade mesmo para múltiplas criações no mesmo ms
                            //  usando um contador global incremental.
                            // =================================================================
                            legalOneUpdateId: ((): number => {
                                const g = global as any;
                                g.__legalOneUpdateCounter = (g.__legalOneUpdateCounter || 0) + 1;
                                // timestamp em micros + contador, negativo para sinalizar "interno"
                                return -(Date.now() * 1000 + g.__legalOneUpdateCounter);
                            })(),
                            date: today,
                            description: description,
                            updatedValue: newValue,
                            source: 'Sistema - Correção Mensal',
                        }
                    });

                    // 5.2. Atualiza o valor principal do Ativo
                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: { currentValue: newValue }
                    });
                });
                
                console.log(`[Cron:UpdateIndices_V4_FIXED] Ativo ${asset.id} (${asset.processNumber}) atualizado para R$ ${newValue.toFixed(2)}`);
            } catch (err: any) {
                 console.error(`[Cron:UpdateIndices_V4_FIXED] FALHA ao atualizar o ativo ${asset.id}:`, err);
            }
        }
        console.log(`[Cron:UpdateIndices_V4_FIXED] Tarefa de atualização monetária concluída.`);
    }
}

export { UpdateMonthlyIndicesUseCase };