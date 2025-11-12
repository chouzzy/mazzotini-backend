// // src/services/economicIndexService.ts
// import axios from 'axios';

// const sgsSeriesIds = {
//     // --- Mensais (Estes são os códigos corretos) ---
//     'SELIC': 432, // Acumulada no mês (Ex: 0.86)
//     'IPCA': 433,  // Variação mensal (Ex: 0.50)
//     'IGP-M': 189, // Variação mensal (Ex: 0.30)
//     'CDI': 12,    // Taxa DI over 252 (Ex: 14.89)
// };
// type IndexType = 'SELIC' | 'IPCA' | 'CDI' | 'IGP-M' | 'Outro';
// interface MonthlyIndexData {
//     date: Date;
//     value: number; 
//     type: 'monthly' | 'annualized';
// }
// const formatDateToBCB = (date: Date): string => {
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}/${month}/${year}`;
// };
// const parseBCBDate = (dateString: string): Date => {
//     const [day, month, year] = dateString.split('/').map(Number);
//     return new Date(year, month - 1, day);
// };
// const getMonthlyIndexSeries = async (
//     indexType: IndexType,
//     startDate: Date,
//     endDate: Date
// ): Promise<MonthlyIndexData[]> => {
//     console.log(`[EconomicIndexService] Buscando série ${indexType} de ${formatDateToBCB(startDate)} até ${formatDateToBCB(endDate)}`);
//     const seriesId = sgsSeriesIds[indexType as keyof typeof sgsSeriesIds];
//     if (!seriesId) {
//         console.warn(`[EconomicIndexService] Índice ${indexType} não mapeado. Retornando série vazia.`);
//         return [];
//     }
//     const seriesType: MonthlyIndexData['type'] = (indexType === 'CDI') ? 'annualized' : 'monthly';
//     const startDateStr = formatDateToBCB(startDate);
//     const endDateStr = formatDateToBCB(endDate);
//     const bcbApiUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;
//     try {
//         const response = await axios.get<{ data: string, valor: string }[]>(bcbApiUrl);
//         const data = response.data;
//         if (!data || data.length === 0) {
//             console.warn(`[EconomicIndexService] Nenhum dado retornado pelo BCB para ${indexType} no período.`);
//             return [];
//         }
//         const seriesData = data.map(entry => ({
//             date: parseBCBDate(entry.data),
//             value: parseFloat(entry.valor.replace(',', '.')),
//             type: seriesType, 
//         }));
//         console.log(`[EconomicIndexService] Série histórica ${indexType} (${seriesType}) com ${seriesData.length} entradas encontrada.`);
//         return seriesData;
//     } catch (error: any) {
//         console.error(`[EconomicIndexService] Erro ao buscar dados do BCB para ${indexType} (Série: ${seriesId}):`, error.response?.data || error.message);
//         return []; 
//     }
// };
// export const economicIndexService = {
//     getMonthlyIndexSeries,
// };