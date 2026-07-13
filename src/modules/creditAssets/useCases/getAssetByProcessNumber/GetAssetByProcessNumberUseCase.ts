import { prisma } from '../../../../prisma';

class GetAssetByProcessNumberUseCase {
    async execute(legalOneId: number, auth0UserId: string, roles: string[]) {

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
                documents: { orderBy: { createdAt: 'desc' } },
                folder: true
            }
        });

        if (!asset) throw new Error("Processo não encontrado.");

        const isAdminOrOperator = roles.includes('ADMIN') || roles.includes('OPERATOR');

        // Admin/Operator vê tudo — retorna direto
        if (isAdminOrOperator) return asset;

        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) throw new Error("Acesso negado.");

        let viewerIsAssociate = false;

        if (roles.includes('ASSOCIATE')) {
            const isLinkedAsAssociate = asset.investors.some(inv => inv.associate?.id === user.id);
            const isLinkedAsInvestor  = asset.investors.some(inv => inv.user?.id === user.id);
            if (!isLinkedAsAssociate && !isLinkedAsInvestor) throw new Error("Acesso negado.");
            viewerIsAssociate = isLinkedAsAssociate && !isLinkedAsInvestor;
        } else if (roles.includes('INVESTOR')) {
            const isInvestor = asset.investors.some(inv => inv.user?.id === user.id);
            if (!isInvestor) throw new Error("Acesso negado.");
        }

        // Associados não veem documentos
        if (viewerIsAssociate) return { ...asset, documents: [] };

        // Clientes veem:
        //  - docs globais (JURIDICO, PROCESSUAL) — investorUserId === null
        //  - docs privados (PRIVADO_FINANCEIRO) apenas os próprios — investorUserId === user.id
        const filteredDocs = asset.documents.filter(doc => {
            if (doc.section !== 'PRIVADO_FINANCEIRO') return true;
            return doc.investorUserId === user.id;
        });

        return { ...asset, documents: filteredDocs };
    }
}

export { GetAssetByProcessNumberUseCase };
