import { prisma } from '../../../../prisma';

export interface ISystemSettings {
    autoImportAppeals: boolean;
    autoImportProceduralIssues: boolean;
    updatedAt: Date;
    updatedBy: string | null;
}

const DEFAULTS: Omit<ISystemSettings, 'updatedAt' | 'updatedBy'> = {
    autoImportAppeals: true,
    autoImportProceduralIssues: true,
};

let cache: ISystemSettings | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minuto

export async function getSystemSettings(): Promise<ISystemSettings> {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_TTL_MS) return cache;

    let record = await prisma.systemSettings.findFirst();

    if (!record) {
        record = await prisma.systemSettings.create({
            data: { ...DEFAULTS, updatedBy: null },
        });
    }

    cache = {
        autoImportAppeals: record.autoImportAppeals,
        autoImportProceduralIssues: record.autoImportProceduralIssues,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
    };
    cacheAt = now;
    return cache;
}

export async function updateSystemSettings(
    data: Partial<Omit<ISystemSettings, 'updatedAt'>>,
    updatedBy?: string
): Promise<ISystemSettings> {
    let record = await prisma.systemSettings.findFirst();

    if (!record) {
        record = await prisma.systemSettings.create({
            data: { ...DEFAULTS, updatedBy: updatedBy || null, ...data },
        });
    } else {
        record = await prisma.systemSettings.update({
            where: { id: record.id },
            data: { ...data, updatedBy: updatedBy || null },
        });
    }

    // invalida cache
    cache = null;

    return {
        autoImportAppeals: record.autoImportAppeals,
        autoImportProceduralIssues: record.autoImportProceduralIssues,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
    };
}
