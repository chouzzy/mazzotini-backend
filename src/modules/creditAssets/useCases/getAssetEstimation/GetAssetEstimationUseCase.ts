import { prisma } from '../../../../prisma';
import { AppError } from '../../../../errors/AppError';
import { ROLES } from '../../../../types';
import { UNSYNCED_STATUSES } from '../listAllAssets/ListAllAssetsUseCase';
// src/modules/creditAssets/useCases/getAssetEstimation/GetAssetEstimationUseCase.ts

// NÂO PRECISAMOS MAIS DO economicIndexService AQUI



/** Quem pede a estimativa: o usuário do token e os papéis que vieram nele. */
export interface EstimateViewer {
    auth0UserId: string;
    roles: string[];
}

const INTERNAL_ROLES = [ROLES.ADMIN, ROLES.OPERATOR];
const OBJECT_ID = /^[a-f0-9]{24}$/i;

interface IResponse {
    currentEstimatedValue: number; // O valor de "hoje"
    timeline: { date: string; value: number }[]; // A projeção futura
}

/**
 * Helper para formatar YYYY-MM-DD
 */
const formatAsISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
}

/**
 * Helper para avançar meses
 */
const addMonths = (date: Date, months: number): Date => {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
}

// ============================================================================
//  MAPA DE PROJEÇÃO (TAXAS ESTIMADAS PARA O FUTURO)
// ============================================================================
// Estes são os nossos "chutes" de mercado para o futuro.
// São usados APENAS para o gráfico de projeção.
const PROJECTED_MONTHLY_RATES = {
    // Valores em FATOR (ex: 0.8% = 0.008)
    'SELIC': 0.008, // Estimativa de 0.8% a.m.
    'IPCA': 0.005,  // Estimativa de 0.5% a.m.
    'CDI': 0.0085,  // Estimativa de 0.85% a.m.
    'IGP-M': 0.006, // Estimativa de 0.6% a.m.
    'Outro': 0.0
};
// ============================================================================


class GetAssetEstimationUseCase {

    async execute(assetId: string, viewer: EstimateViewer): Promise<IResponse> {
        console.log(`[Estimate V3] Iniciando PROJEÇÃO FUTURA para o Ativo ID: ${assetId}`);

        if (!OBJECT_ID.test(assetId)) throw new AppError("Ativo de crédito não encontrado.", 404);
        const asset = await prisma.creditAsset.findUnique({
            where: { id: assetId },
            include: {
                updates: {
                    orderBy: { date: 'desc' },
                    take: 1,
                }
            }
        });

        if (!asset) {
            throw new AppError("Ativo de crédito não encontrado.", 404);
        }
        await this.assertCanView(asset, viewer);

        const indexType = asset.updateIndexType as any || 'Outro';
        const contractualRatePercent = asset.contractualIndexRate || 0; // Ex: 1%

        // 2. Definir o "Ponto A" (O Ponto de Partida)
        // O ponto de partida é SEMPRE o 'currentValue' oficial do ativo.
        const startValue = asset.currentValue;
        const startDate = new Date(); // A projeção começa HOJE

        // =================================================================
        //  MUDANÇA CRÍTICA - NÃO CHAMA MAIS O economicIndexService
        // =================================================================

        // 3. Pega a taxa de projeção "fixa" do nosso mapa
        const estimatedIndexRate = PROJECTED_MONTHLY_RATES[indexType as keyof typeof PROJECTED_MONTHLY_RATES] || 0.0;
        
        // 4. Pega a taxa do contrato
        const contractualRateMonthly = contractualRatePercent / 100; // 1% -> 0.01

        // 5. Calcula o Fator Total Mensal
        // (1 + 0.008) * (1 + 0.01) = 1.008 * 1.01 = 1.01808
        const totalMonthlyFactor = (1 + estimatedIndexRate) * (1 + contractualRateMonthly);
        
        console.log(`[Estimate V3] Ponto de partida: R$ ${startValue}.`);
        console.log(`[Estimate V3] Fator Índice (${indexType}) Projetado: ${(1 + estimatedIndexRate).toFixed(6)}`);
        console.log(`[Estimate V3] Fator Taxa Contratual: ${(1 + contractualRateMonthly).toFixed(6)}`);
        console.log(`[Estimate V3] Fator Total Mensal (Projetado): ${totalMonthlyFactor.toFixed(6)}`);


        // 6. O CÁLCULO MÊS A MÊS (A "Projeção" do Jogo)
        const timeline: { date: string; value: number }[] = [];
        let currentValue = startValue; 

        timeline.push({ date: formatAsISO(startDate), value: currentValue });

        // Projeta os próximos 24 meses
        for (let i = 1; i <= 24; i++) {
            const nextDate = addMonths(startDate, i);
            
            // Aplica o Fator Total (Índice + Bônus)
            currentValue = currentValue * totalMonthlyFactor;

            timeline.push({ date: formatAsISO(nextDate), value: currentValue });
        }

        console.log(`[Estimate V3] Projeção final (24 meses): R$ ${currentValue.toFixed(2)}`);
        
        return {
            currentEstimatedValue: startValue, // O valor de "hoje"
            timeline: timeline // O gráfico para o futuro
        };
    }

    /**
     * Admin e operador veem qualquer processo; cliente e associado, só os que acompanham, e já
     * com os dados do Legal One (como no detalhe do processo). O papel vem do token ou, sem ele,
     * do banco, como no checkRole.
     */
    private async assertCanView(asset: { id: string; status: string | null }, viewer: EstimateViewer) {
        if (viewer.roles.some(role => INTERNAL_ROLES.includes(role))) return;

        const user = await prisma.user.findUnique({
            where: { auth0UserId: viewer.auth0UserId },
            select: { id: true, role: true },
        });
        if (user?.role && INTERNAL_ROLES.includes(user.role)) return;

        const notFound = new AppError("Ativo de crédito não encontrado.", 404);
        if (!user || (asset.status && UNSYNCED_STATUSES.includes(asset.status))) throw notFound;
        const linked = await prisma.investment.count({
            where: { creditAssetId: asset.id, OR: [{ userId: user.id }, { associateId: user.id }] },
        });
        if (!linked) throw notFound;
    }
}

export { GetAssetEstimationUseCase };