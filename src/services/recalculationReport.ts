import { prisma } from '../prisma';
import { notifyAllAdmins } from './notificationService';

export interface RecalculationFailure {
    assetId: string;
    error:   string;
}

/** Quantos processos a notificação lista; os outros entram como "e mais N". */
const MAX_LISTED = 10;

/** Avisa os admins dos processos que o recálculo mensal recusou e que ficaram com o valor anterior. */
export async function notifyRecalculationFailures(failures: RecalculationFailure[]): Promise<void> {
    if (failures.length === 0) return;

    const assets = await prisma.creditAsset.findMany({
        where:  { id: { in: failures.map(f => f.assetId) } },
        select: { id: true, legalOneId: true, processNumber: true },
    });
    const name = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        return asset ? `${asset.processNumber} (Legal One ${asset.legalOneId})` : assetId;
    };
    const listed = failures.slice(0, MAX_LISTED).map(f => `${name(f.assetId)}: ${f.error}`);
    const rest   = failures.length - listed.length;

    await notifyAllAdmins({
        title:            `Recálculo mensal: ${failures.length} ${failures.length === 1 ? 'processo ficou' : 'processos ficaram'} com o valor anterior`,
        message:          `O cálculo foi recusado e o valor atualizado não mudou. ${listed.join(' | ')}${rest > 0 ? ` | e mais ${rest}.` : ''}`,
        type:             'warning',
        notificationType: 'CALCULATION',
        link:             '/processos',
    });
}
