import { notifyAllAdmins } from './notificationService';

export interface RecalculationFailure {
    assetId:        string;
    legalOneId?:    number | null;
    processNumber?: string | null;
    error:          string;
}

/** Quantos processos recusados viram notificação; os demais entram num resumo. */
const MAX_NOTIFIED = 20;

/** Nome do processo no log e na notificação: "número (Legal One N)", ou o id se o processo não existe mais. */
export function describeAsset(f: Pick<RecalculationFailure, 'assetId' | 'legalOneId' | 'processNumber'>): string {
    if (!f.processNumber && !f.legalOneId) return f.assetId;
    return [f.processNumber, f.legalOneId ? `(Legal One ${f.legalOneId})` : null].filter(Boolean).join(' ');
}

/**
 * Avisa os admins dos processos que o recálculo mensal recusou e que ficaram com o valor anterior.
 * É uma notificação por processo, como as de falha no Legal One: o processo aparece na coluna
 * "Cliente / Entidade" e na mensagem, junto com o motivo.
 */
export async function notifyRecalculationFailures(failures: RecalculationFailure[]): Promise<void> {
    for (const f of failures.slice(0, MAX_NOTIFIED)) {
        await notifyAllAdmins({
            title:             'Recálculo mensal recusado',
            message:           `Processo ${describeAsset(f)}: ${f.error} O valor atualizado continua o anterior.`,
            type:              'warning',
            notificationType:  'CALCULATION',
            relatedEntityId:   f.assetId,
            relatedEntityType: 'CreditAsset',
            relatedEntityName: describeAsset(f),
            link:              f.legalOneId ? `/processos/${f.legalOneId}` : '/processos',
        });
    }

    const rest = failures.length - MAX_NOTIFIED;
    if (rest > 0) {
        await notifyAllAdmins({
            title:            'Recálculo mensal recusado',
            message:          `Mais ${rest} ${rest === 1 ? 'processo foi recusado e ficou' : 'processos foram recusados e ficaram'} com o valor anterior. Avise o suporte para ver a lista completa.`,
            type:             'warning',
            notificationType: 'CALCULATION',
            link:             '/processos',
        });
    }
}
