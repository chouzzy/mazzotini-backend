import { PrismaClient } from '@prisma/client';
import { SetCalculationParamsUseCase } from './SetCalculationParamsUseCase';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        creditAsset: { findUnique: jest.fn() },
        processCalculationParams: { upsert: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

/** Cálculo principal fictício, como a calculadora envia. */
const mainCalculation = {
    legalOneId: 123,
    correctionIndex: 'IPCA',
    moratoryMode: 'PERSONALIZADO',
    moratoryRate: 2,
    moratoryType: 'SIMPLES',
    compensatoryRate: 12,
    compensatoryRateUnit: 'AA',
    compensatoryType: 'SIMPLES',
    feesPercentage: 15,
    penaltyPercentage: 0,
    feesOnPenalty: false,
    installments: [{ baseValue: 2000, baseDate: '2025-09-01T00:00:00.000Z', description: 'Parcela A' }],
};

/** Cálculo extra fictício. */
const extraCalculation = (overrides: Record<string, unknown> = {}) => ({
    label: ' Contrato B ',
    correctionIndex: 'INPC',
    moratoryType: 'SIMPLES',
    compensatoryRate: 6,
    compensatoryType: 'SIMPLES',
    feesPercentage: 0,
    penaltyPercentage: 0,
    feesOnPenalty: false,
    installments: [{ baseValue: 700, baseDate: '2025-11-15T00:00:00.000Z' }],
    ...overrides,
});

const upsertArgs = () => prisma.processCalculationParams.upsert.mock.calls[0][0];
const save = (body: Record<string, unknown>) => new SetCalculationParamsUseCase().execute({ ...mainCalculation, ...body });

describe('SetCalculationParamsUseCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.creditAsset.findUnique.mockResolvedValue({ id: 'asset-1' });
        prisma.processCalculationParams.upsert.mockImplementation(({ update }: any) => Promise.resolve(update));
    });

    it('sem os campos dos cálculos extras, não mexe neles (cliente antigo)', async () => {
        await save({});

        expect(upsertArgs().update).not.toHaveProperty('extraCalculations');
        expect(upsertArgs().update).not.toHaveProperty('calculationLabel');
        expect(upsertArgs().update).toMatchObject({ correctionIndex: 'IPCA', compensatoryRateUnit: 'AA', moratoryRateUnit: 'AM' });
    });

    it('grava os cálculos extras com os padrões do schema e as datas em ISO', async () => {
        await save({
            calculationLabel: '  Contrato A ',
            extraCalculations: [extraCalculation({ moratoryStartDate: '2025-11-15' })],
        });

        expect(upsertArgs().update.calculationLabel).toBe('Contrato A');
        expect(upsertArgs().update.extraCalculations).toEqual([expect.objectContaining({
            label: 'Contrato B',
            moratoryMode: 'TAXA_LEGAL',
            moratoryRate: 1,
            moratoryRateUnit: 'AM',
            moratoryStartDate: '2025-11-15T00:00:00.000Z',
            compensatoryRateUnit: 'AM',
            compensatoryStartDate: null,
            multaPercentage: 0,
            feesMode: 'PERCENTUAL',
            feesFixedValue: 0,
            feesOnMulta: false,
            deflate: false,
            installments: [{ baseValue: 700, baseDate: '2025-11-15T00:00:00.000Z' }],
        })]);
    });

    it('grava o modo Tema 1368 e as opções do Dr. Calc; sem elas, as opções ficam desmarcadas', async () => {
        await save({ moratoryMode: 'TAXA_LEGAL_TEMA1368', feesOnMulta: true, deflate: true });
        expect(upsertArgs().update).toMatchObject({ moratoryMode: 'TAXA_LEGAL_TEMA1368', feesOnMulta: true, deflate: true });

        jest.clearAllMocks();
        await save({});
        expect(upsertArgs().update).toMatchObject({ feesOnMulta: false, deflate: false });
    });

    it('cria o registro com os mesmos campos quando o processo ainda não tinha parâmetros', async () => {
        await save({ extraCalculations: [extraCalculation()] });

        expect(upsertArgs().create).toEqual({ assetId: 'asset-1', ...upsertArgs().update });
    });

    it('lista vazia ou null apaga os cálculos extras; nome vazio apaga o do primeiro', async () => {
        await save({ calculationLabel: '', extraCalculations: [] });
        expect(upsertArgs().update.extraCalculations).toEqual([]);
        expect(upsertArgs().update.calculationLabel).toBeNull();

        jest.clearAllMocks();
        await save({ extraCalculations: null });
        expect(upsertArgs().update.extraCalculations).toEqual([]);
    });

    it.each([
        ['data impossível no início dos juros', { moratoryStartDate: '2025-02-31' }, 'Contrato B: início dos juros moratórios: data inválida (2025-02-31).'],
        ['mês 13 numa parcela', { installments: [{ baseValue: 700, baseDate: '2025-13-01' }] }, 'Contrato B: parcela 1: data inválida (2025-13-01).'],
        ['data em outro formato', { compensatoryStartDate: '15/11/2025' }, 'Contrato B: início dos juros remuneratórios: data inválida (15/11/2025).'],
        ['número em texto', { feesMode: 'FIXO', feesFixedValue: '1000' }, 'Contrato B: honorários (R$): valor inválido.'],
        ['booleano em texto', { feesOnPenalty: 'false' }, 'Contrato B: honorários do Art. 523: valor inválido.'],
        ['honorários sobre a multa em texto', { feesOnMulta: 'true' }, 'Contrato B: honorários sobre a multa: valor inválido.'],
        ['deflacionar em número', { deflate: 1 }, 'Contrato B: deflacionar: valor inválido.'],
        ['modo de juros desconhecido', { moratoryMode: 'TEMA_1368' }, 'Contrato B: modo dos juros moratórios: valor inválido (TEMA_1368).'],
        ['opção desconhecida', { moratoryRateUnit: 'AS' }, 'Contrato B: unidade dos juros moratórios: valor inválido (AS).'],
        ['valor de parcela em texto', { installments: [{ baseValue: '700', baseDate: '2025-11-15' }] }, 'Contrato B: parcela 1: valor inválido.'],
        ['sem parcela de débito', { installments: [{ baseValue: 100, baseDate: '2025-11-15', type: 'ABATIMENTO' }] }, 'Contrato B: informe ao menos uma parcela de débito.'],
        ['só com custa', { installments: [{ baseValue: 100, baseDate: '2025-11-15', type: 'CUSTA' }] }, 'Contrato B: informe ao menos uma parcela de débito.'],
        ['tipo de parcela desconhecido', { installments: [{ baseValue: 700, baseDate: '2025-11-15', type: 'MULTA' }] }, 'Contrato B: parcela 1: tipo inválido (MULTA).'],
        ['custa negativa', { installments: [{ baseValue: 700, baseDate: '2025-11-15' }, { baseValue: -100, baseDate: '2025-11-15', type: 'CUSTA' }] }, 'Contrato B: parcela 2: o valor não pode ser negativo.'],
        ['abatimento negativo', { installments: [{ baseValue: 700, baseDate: '2025-11-15' }, { baseValue: -50, baseDate: '2025-11-15', type: 'ABATIMENTO' }] }, 'Contrato B: parcela 2: o valor não pode ser negativo.'],
        ['multa negativa', { multaPercentage: -10 }, 'Contrato B: multa: o valor não pode ser negativo.'],
        ['honorários negativos', { feesPercentage: -10 }, 'Contrato B: honorários (%): o valor não pode ser negativo.'],
        ['honorário fixo negativo', { feesMode: 'FIXO', feesFixedValue: -1000 }, 'Contrato B: honorários (R$): o valor não pode ser negativo.'],
        ['Art. 523 negativo', { penaltyPercentage: -10 }, 'Contrato B: multa do Art. 523: o valor não pode ser negativo.'],
        ['taxa de juros negativa', { moratoryMode: 'PERSONALIZADO', moratoryRate: -1 }, 'Contrato B: taxa dos juros moratórios: o valor não pode ser negativo.'],
        ['ano digitado errado no início dos juros', { moratoryStartDate: '1023-01-01' }, 'Contrato B: início dos juros moratórios: ano fora do intervalo aceito (1900 a 2100) em 1023-01-01.'],
        ['ano digitado errado numa parcela', { installments: [{ baseValue: 700, baseDate: '2205-11-15' }] }, 'Contrato B: parcela 1: ano fora do intervalo aceito (1900 a 2100) em 2205-11-15.'],
        ['sem índice', { correctionIndex: '' }, 'Contrato B: escolha o índice de correção.'],
        ['índice que a tela antiga gravava', { correctionIndex: 'Outro' }, 'Contrato B: índice de correção desconhecido (Outro). Escolha um índice da lista.'],
        ['"fixo" com parcela anterior ao Real', { correctionIndex: 'NAO_ATUALIZAR', installments: [{ baseValue: 700, baseDate: '1990-01-15' }] }, 'Contrato B: "Não atualizar (fixo)" vale para datas a partir de 01/07/1994. Mude a data da parcela de 15/01/1990 ou escolha outro índice.'],
    ])('recusa cálculo extra (%s) sem gravar nada', async (_, overrides, message) => {
        await expect(save({ extraCalculations: [extraCalculation(overrides)] })).rejects.toThrow(message);
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
    });

    it.each([
        ['taxa de juros negativa na taxa legal (o campo some da tela)', { moratoryMode: 'TAXA_LEGAL', moratoryRate: -1 }],
        ['percentual negativo com honorário fixo', { feesMode: 'FIXO', feesFixedValue: 1000, feesPercentage: -10 }],
        ['honorário fixo negativo com honorário em percentual', { feesMode: 'PERCENTUAL', feesFixedValue: -1000 }],
    ])('aceita negativo esquecido em campo que o modo não usa (%s)', async (_, overrides) => {
        await save({ extraCalculations: [extraCalculation(overrides)] });

        expect(prisma.processCalculationParams.upsert).toHaveBeenCalled();
    });

    it.each([
        ['não é uma lista', { extraCalculations: { label: 'x' } }, 'Os cálculos extras devem ser uma lista.'],
        ['item nulo', { extraCalculations: [null] }, 'Cálculo 2: formato inválido.'],
        ['nome que não é texto', { extraCalculations: [extraCalculation({ label: 5 })] }, 'Cálculo 2: nome inválido.'],
        ['mais de 20 extras', { extraCalculations: Array.from({ length: 21 }, () => extraCalculation()) }, 'O processo pode ter até 21 cálculos.'],
    ])('recusa a lista de cálculos extras: %s', async (_, body, message) => {
        await expect(save(body)).rejects.toThrow(message);
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
    });

    it('recusa o cálculo principal sem débito; com extras, a mensagem diz qual é', async () => {
        const onlyAbatimento = { installments: [{ baseValue: 50, baseDate: '2025-09-01', type: 'ABATIMENTO' }] };

        await expect(save(onlyAbatimento)).rejects.toThrow('Informe ao menos uma parcela de débito.');
        await expect(save({ ...onlyAbatimento, calculationLabel: 'Contrato A', extraCalculations: [extraCalculation()] }))
            .rejects.toThrow('Contrato A: informe ao menos uma parcela de débito.');
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
    });

    it('grava a custa ou despesa como um tipo de parcela, sem ponto de dedução', async () => {
        await save({
            installments: [
                ...mainCalculation.installments,
                { baseValue: 350, baseDate: '2025-10-05T00:00:00.000Z', description: 'Perícia', type: 'CUSTA', deductionPoint: 'APOS_TUDO' },
            ],
        });

        expect(upsertArgs().update.installments[1]).toEqual({
            baseValue: 350, baseDate: '2025-10-05T00:00:00.000Z', description: 'Perícia', type: 'CUSTA',
        });
    });

    it('recusa no cálculo principal o índice que o cálculo não aceita', async () => {
        await expect(save({ correctionIndex: 'IPCA15' }))
            .rejects.toThrow('Índice de correção desconhecido (IPCA15). Escolha um índice da lista.');
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
    });
});
