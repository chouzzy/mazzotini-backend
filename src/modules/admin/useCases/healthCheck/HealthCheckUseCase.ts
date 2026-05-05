import { prisma } from '../../../../prisma';
import { auth0ManagementService } from '../../../../services/auth0ManagementService';
import { legalOneApiService } from '../../../../services/legalOneApiService';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

export interface CheckResult {
    name: string;
    status: 'ok' | 'error';
    duration: number;
    message: string;
}

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
    const start = Date.now();
    try {
        const message = await fn();
        return { name, status: 'ok', duration: Date.now() - start, message };
    } catch (err: any) {
        return { name, status: 'error', duration: Date.now() - start, message: err?.message || 'Erro desconhecido' };
    }
}

class HealthCheckUseCase {
    async execute(triggeredBy: 'cron' | 'manual' = 'cron') {
        const checks: CheckResult[] = await Promise.all([
            this.checkDatabase(),
            this.checkAuth0(),
            this.checkLegalOne(),
            this.checkSpaces(),
        ]);

        const hasError = checks.some(c => c.status === 'error');
        const status = hasError ? 'error' : 'ok';

        const log = await prisma.systemHealthLog.create({
            data: { status, checks: checks as any, triggeredBy }
        });

        console.log(`[HEALTH] Run ${log.id}: ${status.toUpperCase()} — ${checks.filter(c => c.status === 'ok').length}/${checks.length} checks passed`);
        return log;
    }

    private checkDatabase() {
        return runCheck('Banco de Dados (MongoDB)', async () => {
            const count = await prisma.user.count();
            return `${count} usuários registrados`;
        });
    }

    private checkAuth0() {
        return runCheck('Auth0 Management API', async () => {
            const roles = await auth0ManagementService.getAllRoles();
            return `API acessível — ${roles.length} roles encontradas`;
        });
    }

    private checkLegalOne() {
        return runCheck('Legal One API', async () => {
            const results = await legalOneApiService.listLawsuits();
            return `API acessível — ${results.length} processos retornados`;
        });
    }

    private checkSpaces() {
        return runCheck('DigitalOcean Spaces (Storage)', async () => {
            const endpoint = process.env.SPACES_ENDPOINT;
            const bucket = process.env.SPACES_BUCKET_NAME;
            if (!endpoint || !bucket) return 'Credenciais não configuradas (ignorado)';

            const region = endpoint.split('.')[0];
            const client = new S3Client({
                endpoint: `https://${endpoint}`,
                region,
                credentials: {
                    accessKeyId: process.env.SPACES_ACCESS_KEY!,
                    secretAccessKey: process.env.SPACES_SECRET_KEY!,
                },
            });
            await client.send(new HeadBucketCommand({ Bucket: bucket }));
            return `Bucket "${bucket}" acessível`;
        });
    }
}

export { HealthCheckUseCase };
