/**
 * Data e hora em Brasília (America/Sao_Paulo), o fuso dos crons. O código não define o fuso do
 * processo, e o servidor pode estar em UTC: às 22h do último dia do mês em Brasília, o relógio do
 * servidor já está no mês seguinte.
 */
export interface SaoPauloDateParts {
    year:  number;
    month: number;   // 1 a 12
    day:   number;
    hour:  number;   // 0 a 23
}

const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year:     'numeric',
    month:    'numeric',
    day:      'numeric',
    hour:     'numeric',
    hourCycle: 'h23',
});

export function saoPauloDateParts(now = new Date()): SaoPauloDateParts {
    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}
