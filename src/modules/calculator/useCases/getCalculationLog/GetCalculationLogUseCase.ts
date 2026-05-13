import { prisma } from '../../../../prisma';

class GetCalculationLogUseCase {
    async execute(legalOneId: number, limit = 10) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const logs = await prisma.calculationLog.findMany({
            where:   { assetId: asset.id },
            orderBy: { calculatedAt: 'desc' },
            take:    limit,
        });

        return logs;
    }
}

export { GetCalculationLogUseCase };
