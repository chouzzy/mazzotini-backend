/**
 * Validação e padrões dos parâmetros de cálculo recebidos em PUT /api/calculator/:legalOneId/params.
 * Vale para o cálculo principal e para os extras (vários cálculos no mesmo processo).
 */

import type { Installment } from '../../services/judicialCalculatorService';

export const MAX_EXTRA_CALCULATIONS = 20;
export const MAX_LABEL_LENGTH = 60;

/** Padrões dos campos que podem faltar: os mesmos do schema do Prisma. */
export const CALCULATION_DEFAULTS = {
    moratoryMode:         'TAXA_LEGAL',
    moratoryRate:         1,
    moratoryRateUnit:     'AM',
    moratoryType:         'SIMPLES',
    compensatoryRate:     0,
    compensatoryRateUnit: 'AM',
    compensatoryType:     'SIMPLES',
    multaPercentage:      0,
    feesMode:             'PERCENTUAL',
    feesPercentage:       0,
    feesFixedValue:       0,
    penaltyPercentage:    0,
    feesOnPenalty:        false,
};

const OPTIONS: Record<string, { label: string; values: string[] }> = {
    moratoryMode:         { label: 'modo dos juros moratórios',   values: ['TAXA_LEGAL', 'PERSONALIZADO'] },
    moratoryRateUnit:     { label: 'unidade dos juros moratórios', values: ['AM', 'AA', 'AD'] },
    moratoryType:         { label: 'tipo dos juros moratórios',   values: ['SIMPLES', 'COMPOSTO'] },
    compensatoryRateUnit: { label: 'unidade dos juros remuneratórios', values: ['AM', 'AA', 'AD'] },
    compensatoryType:     { label: 'tipo dos juros remuneratórios', values: ['SIMPLES', 'COMPOSTO'] },
    feesMode:             { label: 'tipo dos honorários',          values: ['PERCENTUAL', 'FIXO'] },
};

const NUMBERS: Record<string, string> = {
    moratoryRate:      'taxa dos juros moratórios',
    compensatoryRate:  'taxa dos juros remuneratórios',
    multaPercentage:   'multa',
    feesPercentage:    'honorários (%)',
    feesFixedValue:    'honorários (R$)',
    penaltyPercentage: 'multa do Art. 523',
};

const DEDUCTION_POINTS = ['DO_VALOR_CORRIGIDO', 'APOS_HONORARIOS', 'APOS_MULTA', 'APOS_TUDO'];

/** Campos de um cálculo já validados, com os padrões aplicados. */
export interface ValidCalculation {
    correctionIndex:       string;
    moratoryMode:          string;
    moratoryRate:          number;
    moratoryRateUnit:      string;
    moratoryType:          string;
    moratoryStartDate:     Date | null;
    compensatoryRate:      number;
    compensatoryRateUnit:  string;
    compensatoryType:      string;
    compensatoryStartDate: Date | null;
    multaPercentage:       number;
    feesMode:              string;
    feesPercentage:        number;
    feesFixedValue:        number;
    penaltyPercentage:     number;
    feesOnPenalty:         boolean;
    installments:          Installment[];
}

/** Erro com o nome do cálculo na frente quando o processo tem mais de um. */
function fail(calcLabel: string | null, message: string): Error {
    return new Error(calcLabel ? `${calcLabel}: ${message}` : message.charAt(0).toUpperCase() + message.slice(1));
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Data no formato ISO (AAAA-MM-DD, com ou sem hora). Recusa datas fora do calendário,
 * que o `Date` aceitaria em silêncio (31/02 viraria 03/03). Vazia → null.
 */
export function parseCalendarDate(value: unknown, calcLabel: string | null, what: string): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const match = typeof value === 'string' ? value.match(ISO_DATE) : null;
    const date = match ? new Date(value as string) : null;
    if (!match || !date || isNaN(date.getTime())) throw fail(calcLabel, `${what}: data inválida (${String(value)}).`);
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
        throw fail(calcLabel, `${what}: data inválida (${String(value)}).`);
    }
    return date;
}

/** Parcelas de um cálculo: valor numérico, data válida e ao menos uma de débito. */
export function validateInstallments(raw: unknown, calcLabel: string | null): Installment[] {
    if (!Array.isArray(raw)) throw fail(calcLabel, 'as parcelas devem ser uma lista.');

    const installments = raw.map((item: any, i: number): Installment => {
        const what = `parcela ${i + 1}`;
        if (!item || typeof item !== 'object') throw fail(calcLabel, `${what}: formato inválido.`);
        if (typeof item.baseValue !== 'number' || !Number.isFinite(item.baseValue)) {
            throw fail(calcLabel, `${what}: valor inválido.`);
        }
        const date = parseCalendarDate(item.baseDate, calcLabel, what);
        if (!date) throw fail(calcLabel, `${what}: informe a data.`);
        if (item.type !== undefined && item.type !== 'DEBITO' && item.type !== 'ABATIMENTO') {
            throw fail(calcLabel, `${what}: tipo inválido (${String(item.type)}).`);
        }
        if (item.description !== undefined && item.description !== null && typeof item.description !== 'string') {
            throw fail(calcLabel, `${what}: descrição inválida.`);
        }
        const isAbatimento = item.type === 'ABATIMENTO';
        if (isAbatimento && item.deductionPoint !== undefined && !DEDUCTION_POINTS.includes(item.deductionPoint)) {
            throw fail(calcLabel, `${what}: ponto de dedução inválido (${String(item.deductionPoint)}).`);
        }
        return {
            baseValue: item.baseValue,
            baseDate:  date.toISOString(),
            ...(item.description ? { description: item.description } : {}),
            ...(item.type ? { type: item.type } : {}),
            ...(isAbatimento && item.deductionPoint ? { deductionPoint: item.deductionPoint } : {}),
        };
    });

    if (!installments.some(i => (i.type ?? 'DEBITO') === 'DEBITO')) {
        throw fail(calcLabel, 'informe ao menos uma parcela de débito.');
    }
    return installments;
}

/**
 * Campos de um cálculo (o principal ou um extra), com os padrões aplicados.
 * `calcLabel` vai na frente das mensagens quando o processo tem mais de um cálculo.
 */
export function validateCalculation(raw: any, calcLabel: string | null): ValidCalculation {
    if (typeof raw.correctionIndex !== 'string' || !raw.correctionIndex.trim()) {
        throw fail(calcLabel, 'escolha o índice de correção.');
    }

    const values: Record<string, unknown> = {};
    for (const [field, { label, values: allowed }] of Object.entries(OPTIONS)) {
        const value = raw[field] ?? (CALCULATION_DEFAULTS as Record<string, unknown>)[field];
        if (typeof value !== 'string' || !allowed.includes(value)) throw fail(calcLabel, `${label}: valor inválido (${String(value)}).`);
        values[field] = value;
    }
    for (const [field, label] of Object.entries(NUMBERS)) {
        const value = raw[field] ?? (CALCULATION_DEFAULTS as Record<string, unknown>)[field];
        if (typeof value !== 'number' || !Number.isFinite(value)) throw fail(calcLabel, `${label}: valor inválido.`);
        values[field] = value;
    }
    const feesOnPenalty = raw.feesOnPenalty ?? CALCULATION_DEFAULTS.feesOnPenalty;
    if (typeof feesOnPenalty !== 'boolean') throw fail(calcLabel, 'honorários do Art. 523: valor inválido.');

    return {
        ...(values as Omit<ValidCalculation, 'correctionIndex' | 'moratoryStartDate' | 'compensatoryStartDate' | 'feesOnPenalty' | 'installments'>),
        correctionIndex:       raw.correctionIndex,
        moratoryStartDate:     parseCalendarDate(raw.moratoryStartDate, calcLabel, 'início dos juros moratórios'),
        compensatoryStartDate: parseCalendarDate(raw.compensatoryStartDate, calcLabel, 'início dos juros remuneratórios'),
        feesOnPenalty,
        installments:          validateInstallments(raw.installments, calcLabel),
    };
}

/** Nome de um cálculo: texto de até 60 caracteres; vazio → `fallback`. */
export function validateLabel(raw: unknown, fallback: string): string {
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw !== 'string') throw new Error(`${fallback}: nome inválido.`);
    const label = raw.trim();
    if (label.length > MAX_LABEL_LENGTH) throw new Error(`${fallback}: o nome pode ter até ${MAX_LABEL_LENGTH} caracteres.`);
    return label || fallback;
}
