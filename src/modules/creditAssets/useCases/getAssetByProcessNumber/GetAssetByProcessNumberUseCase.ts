import { prisma } from '../../../../prisma';




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
                updates: {
                    where: {
                        OR: [
                            { description: { contains: '#RelatórioMAA' } },
                            { description: { contains: '#RelatorioMAA' } },
                        ]
                    },
                    orderBy: { date: "desc" }
                },
                documents: true,
                folder: true
            }
        });

        if (!asset) {
            throw new Error("Processo não encontrado.");
        }

        // 2. AUDITORIA DE ACESSO (O Cadeado)
        const isAdminOrOperator = roles.includes('ADMIN') || roles.includes('OPERATOR');
        let viewerIsAssociate = false;

        if (!isAdminOrOperator) {
            const user = await prisma.user.findUnique({
                where: { auth0UserId },
                select: { id: true }
            });

            if (!user) throw new Error("Acesso negado.");

            if (roles.includes('ASSOCIATE')) {
                // Associado só acessa processos em que está vinculado via investment.associateId
                const isLinked = asset.investors.some(inv => inv.associate?.id === user.id);
                if (!isLinked) {
                    console.warn(`[SEGURANÇA] Associado ${user.id} tentou aceder ao processo ${legalOneId} sem vínculo.`);
                    throw new Error("Acesso negado.");
                }
                viewerIsAssociate = true;
            } else if (roles.includes('INVESTOR')) {
                const isInvestorInThisAsset = asset.investors.some(inv => inv.user?.id === user.id);
                if (!isInvestorInThisAsset) {
                    console.warn(`[SEGURANÇA] Usuário ${user.id} tentou aceder ao processo ${legalOneId} sem estar vinculado.`);
                    throw new Error("Acesso negado.");
                }
            }
        }

        // Associados não podem ver documentos
        if (viewerIsAssociate) {
            return { ...asset, documents: [] };
        }

        return asset;
    }
}

export { GetAssetByProcessNumberUseCase };