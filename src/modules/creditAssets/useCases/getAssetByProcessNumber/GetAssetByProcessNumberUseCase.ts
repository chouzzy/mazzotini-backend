import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class GetAssetByProcessNumberUseCase {
    async execute(legalOneId: number, auth0UserId: string, roles: string[]) {

        // 1. Busca o processo com todas as relações
        const asset = await prisma.creditAsset.findUnique({
            where: { legalOneId },
            include: {
                investors: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        associate: { select: { id: true, name: true, email: true } }
                    }
                },
                associate: { select: { id: true, name: true, email: true } },
                updates: { orderBy: { date: "desc" } },
                documents: true,
                folder: true
            }
        });

        if (!asset) {
            throw new Error("Processo não encontrado.");
        }

        // 2. AUDITORIA DE ACESSO (O Cadeado)
        const isAdminOrOperator = roles.includes('ADMIN') || roles.includes('OPERATOR');

        // Se NÃO for Admin/Operador, temos de garantir que ele está vinculado ao processo
        if (!isAdminOrOperator) {
            const user = await prisma.user.findUnique({
                where: { auth0UserId },
                select: { id: true }
            });

            if (!user) {
                throw new Error("Acesso negado.");
            }

            if (roles.includes('INVESTOR') || roles.includes('ASSOCIATE')) {
                // Verifica se o ID do usuário está dentro da lista de investidores DESTE processo
                const isInvestorInThisAsset = asset.investors.some(inv => inv.user?.id === user.id);
                if (!isInvestorInThisAsset) {
                    console.warn(`[SEGURANÇA] Usuário ${user.id} tentou aceder ao processo ${legalOneId} sem estar vinculado.`);
                    throw new Error("Acesso negado.");
                }
            }
        }

        // Se passou pela auditoria (ou é admin), devolve os dados
        return asset;
    }
}

export { GetAssetByProcessNumberUseCase };