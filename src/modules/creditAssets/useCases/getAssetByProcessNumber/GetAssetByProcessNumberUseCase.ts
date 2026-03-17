import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class GetAssetByProcessNumberUseCase {
    async execute(processNumber: string, auth0UserId: string, roles: string[]) {
        
        // 1. Busca o processo com todas as relações
        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
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

            if (roles.includes('INVESTOR')) {
                // Verifica se o ID do investidor está dentro da lista de investidores DESTE processo
                const isInvestorInThisAsset = asset.investors.some(inv => inv.user?.id === user.id);
                if (!isInvestorInThisAsset) {
                    console.warn(`[SEGURANÇA] Investidor ${user.id} tentou aceder ao processo ${processNumber} sem estar vinculado.`);
                    throw new Error("Acesso negado.");
                }
            } 
            else if (roles.includes('ASSOCIATE')) {
                // Verifica se ele é o associado global do processo OU o associado de algum investidor específico
                const isMainAssociate = asset.associate?.id === user.id;
                const isInvestorAssociate = asset.investors.some(inv => inv.associate?.id === user.id);
                
                if (!isMainAssociate && !isInvestorAssociate) {
                    console.warn(`[SEGURANÇA] Associado ${user.id} tentou aceder ao processo ${processNumber} sem estar vinculado.`);
                    throw new Error("Acesso negado.");
                }
            }
        }

        // Se passou pela auditoria (ou é admin), devolve os dados
        return asset;
    }
}

export { GetAssetByProcessNumberUseCase };