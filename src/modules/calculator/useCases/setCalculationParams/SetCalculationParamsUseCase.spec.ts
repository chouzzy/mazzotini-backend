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
            installments: [{ baseValue: 700, baseDate: '2025-11-15T00:00:00.000Z' }],
        })]);
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
        ['booleano em texto', { feesOnPenalty: 'false' }, 'Contrato B: honorários sobre a multa do Art. 523: valor inválido.'],
        ['opção desconhecida', { moratoryRateUnit: 'AS' }, 'Contrato B: unidade dos juros moratórios: valor inválido (AS).'],
        ['valor de parcela em texto', { installments: [{ baseValue: '700', baseDate: '2025-11-15' }] }, 'Contrato B: parcela 1: valor inválido.'],
        ['sem parcela de débito', { installments: [{ baseValue: 100, baseDate: '2025-11-15', type: 'ABATIMENTO' }] }, 'Contrato B: informe ao menos uma parcela de débito.'],
        ['sem índice', { correctionIndex: '' }, 'Contrato B: escolha o índice de correção.'],
    ])('recusa cálculo extra (%s) sem gravar nada', async (_, overrides, message) => {
        await expect(save({ extraCalculations: [extraCalculation(overrides)] })).rejects.toThrow(message);
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
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
});
