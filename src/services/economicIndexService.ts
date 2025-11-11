// src/services/economicIndexService.ts
import axios from 'axios';

// ============================================================================
//  MAPA DE SÉRIES DO BANCO CENTRAL (SGS)
// ============================================================================
//
// 1. Índices Mensais (SELIC, IPCA, IGP-M)
//    - A API retorna o *percentual* do mês. Ex: "0.86" (para 0.86%)
//    - Fórmula: (1 + (valor / 100))
//
// 2. Índices Anualizados (CDI)
//    - A API retorna a *taxa anualizada* base 252. Ex: "14.89" (para 14.89% a.a.)
//    - Fórmula (para achar o fator mensal): (1 + (valor / 100)) ^ (1/12)
//
// ============================================================================

const sgsSeriesIds = {
    // --- Mensais (Estes são os códigos corretos) ---
    'SELIC': 432, // Acumulada no mês (Ex: 0.86)
    'IPCA': 433,  // Variação mensal (Ex: 0.50)
    'IGP-M': 189, // Variação mensal (Ex: 0.30)
    
    // --- Anualizados ---
    'CDI': 12,    // Taxa DI over 252 (Ex: 14.89)
};

type IndexType = 'SELIC' | 'IPCA' | 'CDI' | 'IGP-M' | 'Outro';

interface MonthlyIndexData {
    date: Date;
    value: number; // O valor *bruto* do BCB (ex: 0.86 ou 14.89)
    type: 'monthly' | 'annualized'; // O tipo de taxa que o BCB retornou
}

/**
 * Formata uma data para o formato DD/MM/YYYY exigido pela API do BCB.
 */
const formatDateToBCB = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Converte a string 'DD/MM/YYYY' do BCB para um objeto Date.
 */
const parseBCBDate = (dateString: string): Date => {
    const [day, month, year] = dateString.split('/').map(Number);
    // O mês no JS Date é 0-indexado (0 = Jan, 11 = Dez)
    return new Date(year, month - 1, day);
};

/**
 * Busca a *série histórica mensal* de um índice entre duas datas.
 */
const getMonthlyIndexSeries = async (
    indexType: IndexType,
    startDate: Date,
    endDate: Date
): Promise<MonthlyIndexData[]> => {

    console.log(`[EconomicIndexService] Buscando série ${indexType} de ${formatDateToBCB(startDate)} até ${formatDateToBCB(endDate)}`);

    const seriesId = sgsSeriesIds[indexType as keyof typeof sgsSeriesIds];
    if (!seriesId) {
        console.warn(`[EconomicIndexService] Índice ${indexType} não mapeado. Retornando série vazia.`);
        return [];
    }

    // Define se o cálculo é (1 + V/100) ou (1 + V/100)^(1/12)
    const seriesType: MonthlyIndexData['type'] = (indexType === 'CDI') ? 'annualized' : 'monthly';

    const startDateStr = formatDateToBCB(startDate);
    const endDateStr = formatDateToBCB(endDate);
    
    const bcbApiUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;

    try {
        const response = await axios.get<{ data: string, valor: string }[]>(bcbApiUrl);
        const data = response.data;

        if (!data || data.length === 0) {
            console.warn(`[EconomicIndexService] Nenhum dado retornado pelo BCB para ${indexType} no período.`);
            return [];
        }

        // Mapeia a resposta da API para um formato limpo
        const seriesData: MonthlyIndexData[] = data.map(entry => ({
            date: parseBCBDate(entry.data),
            value: parseFloat(entry.valor.replace(',', '.')), // Ex: 0.86 (SELIC) or 14.89 (CDI)
            type: seriesType,
        }));

        console.log(`[EconomicIndexService] Série histórica ${indexType} (${seriesType}) com ${seriesData.length} entradas encontrada.`);
        return seriesData;

    } catch (error: any) {
        console.error(`[EconomicIndexService] Erro ao buscar dados do BCB para ${indexType} (Série: ${seriesId}):`, error.response?.data || error.message);
        return []; // Retorna vazio em caso de falha
    }
};

export const economicIndexService = {
    getMonthlyIndexSeries, // Expondo a nova função
};