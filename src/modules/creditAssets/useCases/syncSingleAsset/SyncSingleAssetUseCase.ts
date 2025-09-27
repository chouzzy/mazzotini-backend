import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

const parseValueFromNotes = (notes: string | null): number | null => {
    if (!notes) return null;
    const valueMatch = notes.match(/Valor:\s*R\$\s*([\d.,]+)/i);
    if (valueMatch && valueMatch[1]) {
        const numericString = valueMatch[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(numericString);
    }
    return null;
};

class SyncSingleAssetUseCase {
    async execute(processNumber: string): Promise<void> {
        console.log(`[SYNC MANUAL] Iniciando sincronização para o processo: ${processNumber}`);

        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
            include: { updates: { select: { description: true, date: true } } }
        });

        if (!asset) {
            throw new Error("Ativo não encontrado na base de dados local.");
        }

        const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
        const legalOneUpdates = await legalOneApiService.getProcessUpdates(lawsuitData.id);

        const existingUpdates = new Set(asset.updates.map(u => `${u.description}-${new Date(u.date).toISOString()}`));
        const newUpdates = legalOneUpdates.filter(update => 
            !existingUpdates.has(`${update.description}-${new Date(update.date).toISOString()}`)
        );

        if (newUpdates.length === 0) {
            console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhum novo andamento encontrado.`);
            return;
        }

        console.log(`[SYNC MANUAL] ${newUpdates.length} novo(s) andamento(s) encontrado(s)!`);

        let latestCurrentValue = asset.currentValue;

        for (const update of newUpdates) {
            const extractedValue = parseValueFromNotes(update.notes);
            if (extractedValue !== null) {
                latestCurrentValue = extractedValue;
            }
            await prisma.assetUpdate.create({
                data: {
                    assetId: asset.id,
                    date: new Date(update.date),
                    description: update.description,
                    updatedValue: extractedValue || latestCurrentValue,
                    source: `Legal One - ${update.originType}`,
                }
            });
        }
        
        if (latestCurrentValue !== asset.currentValue) {
            await prisma.creditAsset.update({
                where: { id: asset.id },
                data: { currentValue: latestCurrentValue }
            });
        }
    }
}

export { SyncSingleAssetUseCase };
