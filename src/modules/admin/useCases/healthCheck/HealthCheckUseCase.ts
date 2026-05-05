import { prisma } from '../../../../prisma';
import { auth0ManagementService } from '../../../../services/auth0ManagementService';
import { legalOneApiService } from '../../../../services/legalOneApiService';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

export interface CheckResult {
    name: string;
    group: string;
    status: 'ok' | 'warning' | 'error';
    duration: number;
    message: string;
}

async function runCheck(
    name: string,
    group: string,
    fn: () => Promise<string>
): Promise<CheckResult> {
    const start = Date.now();
    try {
        const message = await fn();
        return { name, group, status: 'ok', duration: Date.now() - start, message };
    } catch (err: any) {
        return { name, group, status: 'error', duration: Date.now() - start, message: err?.message || 'Erro desconhecido' };
    }
}

class HealthCheckUseCase {
    async execute(triggeredBy: 'cron' | 'manual' = 'cron') {
        const checks: CheckResult[] = await Promise.all([
            // Infraestrutura
            this.checkDatabase(),
            this.checkAuth0(),
            this.checkSpaces(),

            // Legal One (1 processo apenas — sem rate limit)
            this.checkLegalOne(),

            // Formulários: use cases que alimentam os selectors
            this.checkAssociates(),
            this.checkAssets(),
            this.checkPendingUsers(),

            // Integridade de dados
            this.checkStuckProcesses(),
            this.checkStuckUsers(),
        ]);

        const hasError    = checks.some(c => c.status === 'error');
        const hasWarning  = checks.some(c => c.status === 'warning');
        const status      = hasError ? 'error' : hasWarning ? 'degraded' : 'ok';

        const log = await prisma.systemHealthLog.create({
            data: { status, checks: checks as any, triggeredBy }
        });

        const ok = checks.filter(c => c.status === 'ok').length;
        console.log(`[HEALTH] Run ${log.id}: ${status.toUpperCase()} — ${ok}/${checks.length} checks passed`);
        return log;
    }

    // ── INFRAESTRUTURA ────────────────────────────────────────────────────────

    private checkDatabase() {
        return runCheck('Banco de Dados (MongoDB)', 'Infraestrutura', async () => {
            const [users, assets] = await Promise.all([
                prisma.user.count(),
                prisma.creditAsset.count(),
            ]);
            return `${users} usuários · ${assets} ativos`;
        });
    }

    private checkAuth0() {
        return runCheck('Auth0 Management API', 'Infraestrutura', async () => {
            const roles = await auth0ManagementService.getAllRoles();
            return `${roles.length} roles encontradas`;
        });
    }

    private checkSpaces() {
        return runCheck('DigitalOcean Spaces', 'Infraestrutura', async () => {
            const endpoint = process.env.SPACES_ENDPOINT;
            const bucket   = process.env.SPACES_BUCKET_NAME;
            if (!endpoint || !bucket) return 'Credenciais não configuradas (ignorado)';
            const region = endpoint.split('.')[0];
            const client = new S3Client({
                endpoint: `https://${endpoint}`,
                region,
                credentials: {
                    accessKeyId:     process.env.SPACES_ACCESS_KEY!,
                    secretAccessKey: process.env.SPACES_SECRET_KEY!,
                },
            });
            await client.send(new HeadBucketCommand({ Bucket: bucket }));
            return `Bucket "${bucket}" acessível`;
        });
    }

    // ── LEGAL ONE (1 processo) ─────────────────────────────────────────────────

    private checkLegalOne() {
        return runCheck('Legal One API', 'Legal One', async () => {
            // ping(): auth + $top=1&$select=id — 1 única chamada, sem participantes
            return await legalOneApiService.ping();
        });
    }

    // ── FORMULÁRIOS ───────────────────────────────────────────────────────────

    private checkAssociates() {
        return runCheck('Lista de Associados (selector de forms)', 'Formulários', async () => {
            const count = await prisma.user.count({ where: { role: 'ASSOCIATE' } });
            if (count === 0) return 'Nenhum associado cadastrado — selector estará vazio';
            return `${count} associados disponíveis`;
        });
    }

    private checkAssets() {
        return runCheck('Lista de Ativos (selector da carteira)', 'Formulários', async () => {
            const count = await prisma.creditAsset.count({ where: { legalOneType: 'Lawsuit' } });
            if (count === 0) throw new Error('Nenhum processo Lawsuit encontrado — selector estará vazio');
            return `${count} processos disponíveis para vinculação`;
        });
    }

    private checkPendingUsers() {
        return runCheck('Usuários Pendentes de Aprovação (fluxo admin)', 'Formulários', async () => {
            const count = await prisma.user.count({ where: { status: 'PENDING_REVIEW' } });
            return `${count} usuário(s) aguardando aprovação`;
        });
    }

    // ── INTEGRIDADE DE DADOS ──────────────────────────────────────────────────

    private checkStuckProcesses() {
        return runCheck('Processos presos (PENDING_ENRICHMENT > 7 dias)', 'Integridade', async () => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const count = await prisma.creditAsset.count({
                where: {
                    status: 'PENDING_ENRICHMENT',
                    createdAt: { lt: sevenDaysAgo },
                },
            });
            if (count > 0) {
                // warning — não é crítico, mas exige atenção
                throw new Error(`${count} processo(s) com PENDING_ENRICHMENT há mais de 7 dias`);
            }
            return 'Nenhum processo preso no enriquecimento';
        });
    }

    private checkStuckUsers() {
        return runCheck('Usuários presos (PENDING_REVIEW > 30 dias)', 'Integridade', async () => {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const count = await prisma.user.count({
                where: {
                    status: 'PENDING_REVIEW',
                    createdAt: { lt: thirtyDaysAgo },
                },
            });
            if (count > 0) {
                throw new Error(`${count} usuário(s) em PENDING_REVIEW há mais de 30 dias`);
            }
            return 'Nenhum usuário preso na revisão';
        });
    }
}

export { HealthCheckUseCase };
