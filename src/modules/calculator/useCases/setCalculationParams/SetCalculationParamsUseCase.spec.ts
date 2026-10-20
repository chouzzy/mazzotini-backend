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

/** Parâmetros fictícios do primeiro cálculo, como a calculadora envia. */
const mainCalculation = {
    legalOneId: 123,
    correctionIndex: 'TJSP_LEI14905',
    moratoryMode: 'PERSONALIZADO',
    moratoryRate: 1,
    moratoryType: 'SIMPLES',
    compensatoryRate: 10,
    compensatoryRateUnit: 'AA',
    compensatoryType: 'SIMPLES',
    feesPercentage: 10,
    penaltyPercentage: 0,
    feesOnPenalty: false,
    installments: [{ baseValue: 1000, baseDate: '2025-10-01T00:00:00.000Z', description: 'Parcela exemplo' }],
};

/** O `update` que o use case mandou para o upsert. */
const updateData = () => prisma.processCalculationParams.upsert.mock.calls[0][0].update;

describe('SetCalculationParamsUseCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.creditAsset.findUnique.mockResolvedValue({ id: 'asset-1' });
        prisma.processCalculationParams.upsert.mockImplementation(({ update }: any) => Promise.resolve(update));
    });

    it('sem os campos dos cálculos extras, não mexe neles (cliente antigo)', async () => {
        await new SetCalculationParamsUseCase().execute(mainCalculation);

        expect(updateData()).not.toHaveProperty('extraCalculations');
        expect(updateData()).not.toHaveProperty('calculationLabel');
        expect(updateData()).toMatchObject({ correctionIndex: 'TJSP_LEI14905', compensatoryRateUnit: 'AA' });
    });

    it('grava os cálculos extras com os padrões do primeiro e as datas em ISO', async () => {
        await new SetCalculationParamsUseCase().execute({
            ...mainCalculation,
            calculationLabel: '  Contrato 1 ',
            extraCalculations: [{
                label: ' Contrato 2 ',
                correctionIndex: 'TJSP_LEI14905',
                moratoryRate: 1,
                moratoryType: 'SIMPLES',
                moratoryStartDate: '2025-12-10',
                compensatoryRate: 5,
                compensatoryType: 'SIMPLES',
                feesPercentage: 0,
                penaltyPercentage: 0,
                feesOnPenalty: false,
                installments: [{ baseValue: 500, baseDate: '2025-12-10T00:00:00.000Z' }],
            }],
        });

        expect(updateData().calculationLabel).toBe('Contrato 1');
        expect(updateData().extraCalculations).toEqual([expect.objectContaining({
            label: 'Contrato 2',
            moratoryMode: 'TAXA_LEGAL',
            moratoryRateUnit: 'AM',
            moratoryStartDate: '2025-12-10T00:00:00.000Z',
            compensatoryRateUnit: 'AM',
            compensatoryStartDate: null,
            multaPercentage: 0,
            feesMode: 'PERCENTUAL',
            feesFixedValue: 0,
        })]);
    });

    it('lista vazia apaga os cálculos extras e o nome do primeiro', async () => {
        await new SetCalculationParamsUseCase().execute({ ...mainCalculation, calculationLabel: '', extraCalculations: [] });

        expect(updateData().extraCalculations).toEqual([]);
        expect(updateData().calculationLabel).toBeNull();
    });

    it('recusa um cálculo extra sem parcela de débito, sem gravar nada', async () => {
        const semDebito = {
            ...mainCalculation,
            label: 'Contrato 2',
            installments: [{ baseValue: 100, baseDate: '2025-12-10T00:00:00.000Z', type: 'ABATIMENTO' as const }],
        };

        await expect(new SetCalculationParamsUseCase().execute({ ...mainCalculation, extraCalculations: [semDebito] }))
            .rejects.toThrow('Contrato 2: informe ao menos uma parcela de débito.');
        expect(prisma.processCalculationParams.upsert).not.toHaveBeenCalled();
    });

    it('recusa data inválida num cálculo extra', async () => {
        const dataInvalida = { ...mainCalculation, label: 'Contrato 2', moratoryStartDate: '31/02/2025' };

        await expect(new SetCalculationParamsUseCase().execute({ ...mainCalculation, extraCalculations: [dataInvalida] }))
            .rejects.toThrow('Contrato 2: data inválida (31/02/2025).');
    });
});
