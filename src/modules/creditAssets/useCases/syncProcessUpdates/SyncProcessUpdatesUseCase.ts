// /src/modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

/**
 * Extrai múltiplos valores e o texto livre de uma string de anotações
 * que segue o padrão #SM.
 */
const parseAllValuesFromNotes = (notes: string | null): Partial<{ originalValue: number, acquisitionValue: number, currentValue: number, updateText: string }> => {
    if (!notes || !notes.includes('#SM')) {
        return {};
    }

    const parseValue = (key: string): number | undefined => {
        const regex = new RegExp(`${key}:\\s*R\\$\\s*([\\d.,]+)`, 'i');
        const match = notes.match(regex);
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            return parseFloat(numericString);
        }
        return undefined;
    };

    // Extrai o texto livre que vem depois dos campos de valor
    // A lógica assume que o texto livre começa após a última linha de valor.
    const textStartIndex = notes.lastIndexOf('R$');
    const updateText = textStartIndex !== -1 ? notes.substring(notes.indexOf('\n', textStartIndex)).trim() : '';

    return {
        originalValue: parseValue('Valor da Causa'),
        acquisitionValue: parseValue('Valor da Compra'),
        currentValue: parseValue('Valor Atualizado'),
        updateText: updateText,
    };
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

        console.log(`[CRON JOB] ${activeAssets.length} ativos encontrados.`);

        for (const asset of activeAssets) {
            try {
                const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
                if (!lawsuitData) continue;

                const legalOneUpdates = await legalOneApiService.getProcessUpdates(lawsuitData.id);

                const existingUpdates = new Set(asset.updates.map(u => `${u.description}-${new Date(u.date).toISOString()}`));
                
                const newUpdates = legalOneUpdates.filter(update => 
                    !existingUpdates.has(`${update.description}-${new Date(update.date).toISOString()}`)
                );

                if (newUpdates.length === 0) {
                    console.log(`[CRON JOB] Processo ${asset.processNumber}: Nenhum novo andamento encontrado.`);
                    continue;
                }
                
                // Filtra para processar apenas os andamentos que contêm nossa tag
                const updatesToSync = newUpdates.filter(upd => upd.notes?.includes('#SM'));
                
                if(updatesToSync.length === 0) {
                    console.log(`[CRON JOB] Processo ${asset.processNumber}: Novos andamentos encontrados, mas nenhum com a tag #SM.`);
                    continue;
                }

                console.log(`[CRON JOB] Processo ${asset.processNumber}: ${updatesToSync.length} novo(s) andamento(s) com a tag #SM encontrado(s)!`);

                await prisma.$transaction(async (tx) => {
                    // Pega os valores atuais como base
                    let latestCurrentValue = asset.currentValue;
                    let latestAcquisitionValue = asset.acquisitionValue;
                    let latestOriginalValue = asset.originalValue;

                    // Ordena os andamentos a sincronizar do mais antigo para o mais recente
                    updatesToSync.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    for (const update of updatesToSync) {
                        const parsedData = parseAllValuesFromNotes(update.notes);
                        
                        // Atualiza os valores mais recentes a cada iteração
                        if (parsedData.currentValue !== undefined) latestCurrentValue = parsedData.currentValue;
                        if (parsedData.acquisitionValue !== undefined) latestAcquisitionValue = parsedData.acquisitionValue;
                        if (parsedData.originalValue !== undefined) latestOriginalValue = parsedData.originalValue;

                        // Cria o registo de atualização no nosso sistema
                        await tx.assetUpdate.create({
                            data: {
                                assetId: asset.id,
                                date: new Date(update.date),
                                description: parsedData.updateText || update.description, // Prioriza o texto livre extraído
                                updatedValue: parsedData.currentValue || latestCurrentValue,
                                source: `Legal One - ${update.originType}`,
                            }
                        });
                    }
                    
                    // Atualiza o ativo principal com os valores do último andamento processado
                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: { 
                            currentValue: latestCurrentValue,
                            acquisitionValue: latestAcquisitionValue,
                            originalValue: latestOriginalValue
                        }
                    });
                });

            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
                continue;
            }
        }
        console.log(`[CRON JOB] Sincronização de andamentos concluída.`);
    }
}

export { SyncProcessUpdatesUseCase };

