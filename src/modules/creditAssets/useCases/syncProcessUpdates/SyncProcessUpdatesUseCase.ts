// /src/modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

/**
 * Tenta extrair todos os valores monetários de uma string de texto.
 */
const extractAllValues = (text: string | null | undefined) => {
    if (!text) return { valorDaCausa: null, valorDaCompra: null, valorAtualizado: null };

    const parse = (match: RegExpMatchArray | null, truncate = false) => {
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(numericString);
            return truncate ? Math.trunc(value) : value;
        }
        return null;
    };

    const valorDaCausa = text.match(/Valor da Causa:\s*R\$\s*([\d.,]+)/i);
    const valorDaCompra = text.match(/Valor da Compra:\s*R\$\s*([\d.,]+)/i);
    const valorAtualizado = text.match(/Valor Atualizado:\s*R\$\s*([\d.,]+)/i);

    console.log('Extraído:', { valorDaCausa, valorDaCompra, valorAtualizado });

    return {
        valorDaCausa: parse(valorDaCausa),
        valorDaCompra: parse(valorDaCompra, true), 
        valorAtualizado: parse(valorAtualizado),
    };
};

/**
 * Extrai apenas o texto descritivo do andamento, ignorando a tag #SM e os campos de valor.
 */
const extractFreeText = (description: string | null | undefined): string => {
    if (!description || !description.includes('#SM')) {
        return description || "Atualização de Valor";
    }
    const lastValueIndex = description.lastIndexOf('R$');
    if (lastValueIndex === -1) return description.substring(description.indexOf('#SM') + 3).trim();
    const textStartIndex = description.indexOf('\n', lastValueIndex);
    if (textStartIndex === -1) return "Atualização de valores do processo";
    return description.substring(textStartIndex).trim();
};

class SyncProcessUpdatesUseCase {
    async execute(): Promise<void> {
        console.log(`[CRON JOB] Iniciando a sincronização de andamentos...`);

        const activeAssets = await prisma.creditAsset.findMany({
            where: { status: 'Ativo' },
            include: { updates: { select: { description: true, date: true } } }
        });

        if (activeAssets.length === 0) {
            console.log("[CRON JOB] Nenhum ativo ativo encontrado para sincronizar.");
            return;
        }
        console.log(`[CRON JOB] ${activeAssets.length} ativos encontrados para verificação.`);

        for (const asset of activeAssets) {
            try {
                const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
                if (!lawsuitData) continue;

                const legalOneUpdates = await legalOneApiService.getProcessUpdates(lawsuitData.id);
                
                // LÓGICA DE DUPLICIDADE (sem o legalOneUpdateId)
                const existingUpdates = new Set(asset.updates.map(u => `${u.description}-${new Date(u.date).toISOString()}`));
                
                const newUpdates = legalOneUpdates.filter(update => {
                    const uniqueKey = `${update.description}-${new Date(update.date).toISOString()}`;
                    return !existingUpdates.has(uniqueKey);
                });

                if (newUpdates.length === 0) {
                    console.log(`[CRON JOB] Processo ${asset.processNumber}: Nenhum novo andamento encontrado.`);
                    continue;
                }

                console.log(`[CRON JOB] Processo ${asset.processNumber}: ${newUpdates.length} novo(s) andamento(s) encontrado(s)!`);
                
                const sortedNewUpdates = newUpdates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                await prisma.$transaction(async (tx) => {
                    let currentAssetValues = {
                        originalValue: asset.originalValue,
                        acquisitionValue: asset.acquisitionValue,
                        currentValue: asset.currentValue,
                    };

                    for (const update of sortedNewUpdates) {
                        const allValues = extractAllValues(update.description);
                        const updateText = extractFreeText(update.description);

                        console.log(`All values extracted from update:`, allValues);
                        
                        if (allValues.valorDaCausa !== null) {
                            currentAssetValues.originalValue = allValues.valorDaCausa;
                        }
                        if (allValues.valorDaCompra !== null) {
                            currentAssetValues.acquisitionValue = allValues.valorDaCompra;
                        }
                        if (allValues.valorAtualizado !== null) {
                            currentAssetValues.currentValue = allValues.valorAtualizado;
                        }

                        await tx.assetUpdate.create({
                            data: {
                                assetId: asset.id,
                                date: new Date(update.date),
                                description: updateText, // Salva o texto limpo
                                updatedValue: allValues.valorAtualizado ?? currentAssetValues.currentValue,
                                source: `Legal One - ${update.originType}`,
                            }
                        });
                    }

                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: {
                            originalValue: currentAssetValues.originalValue,
                            acquisitionValue: currentAssetValues.acquisitionValue,
                            currentValue: currentAssetValues.currentValue,
                        }
                    });
                });

                console.log(`✅ Ativo ${asset.id} sincronizado com ${newUpdates.length} novos andamentos!`);

            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
                continue;
            }
        }
        console.log(`[CRON JOB] Sincronização de andamentos concluída.`);
    }
}

export { SyncProcessUpdatesUseCase };

