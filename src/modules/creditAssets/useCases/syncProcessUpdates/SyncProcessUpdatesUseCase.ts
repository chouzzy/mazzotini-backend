// /src/modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

/**
 * Tenta extrair todos os valores monetários de uma string de texto.
 */
const extractAllValues = (text: string | null | undefined) => {
    if (!text) return { valorDaCausa: null, valorDaCompra: null, valorAtualizado: null };

    const parse = (match: RegExpMatchArray | null) => {
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            return parseFloat(numericString);
        }
        return null;
    };

    const valorDaCausa = text.match(/Valor da causa:\s*R\$\s*([\d.,]+)/i);
    const valorDaCompra = text.match(/Valor da compra:\s*R\$\s*([\d.,]+)/i);
    const valorAtualizado = text.match(/Valor atualizado:\s*R\$\s*([\d.,]+)/i);

    return {
        valorDaCausa: parse(valorDaCausa),
        valorDaCompra: parse(valorDaCompra),
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

                // Inicializa com os valores atuais do nosso banco
                let latestValues = {
                    currentValue: asset.currentValue,
                    originalValue: asset.originalValue,
                    acquisitionValue: asset.acquisitionValue,
                };

                await prisma.$transaction(async (tx) => {
                    for (const update of newUpdates) {
                        const allValues = extractAllValues(update.fullDescription || update.description);
                        const updateText = extractFreeText(update.fullDescription || update.description);

                        // LÓGICA DE ATUALIZAÇÃO SEGURA: Só atualiza o que encontrar
                        if (allValues.valorAtualizado !== null) {
                            latestValues.currentValue = allValues.valorAtualizado;
                        }
                        if (allValues.valorDaCausa !== null) {
                            latestValues.originalValue = allValues.valorDaCausa;
                        }
                        if (allValues.valorDaCompra !== null) {
                            latestValues.acquisitionValue = allValues.valorDaCompra;
                        }

                        await tx.assetUpdate.create({
                            data: {
                                assetId: asset.id,
                                date: new Date(update.date),
                                description: (update.fullDescription || update.description),
                                updatedValue: allValues.valorAtualizado || latestValues.currentValue,
                                source: `Legal One - ${update.originType}`,
                            }
                        });
                    }

                    // Atualiza o ativo principal com os valores mais recentes, preservando os que não foram encontrados
                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: {
                            originalValue: latestValues.originalValue,
                            acquisitionValue: latestValues.acquisitionValue,
                            currentValue: latestValues.currentValue,
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

