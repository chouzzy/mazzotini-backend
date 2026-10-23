import { prisma } from '../../../../prisma';
import { UNSYNCED_STATUSES } from '../listAllAssets/ListAllAssetsUseCase';
import { VISIBLE_UPDATES_FILTER } from '../../../../utils/updateDescriptionParser';

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
                    where: VISIBLE_UPDATES_FILTER,
                    orderBy: { date: "desc" }
                },
                documents: { orderBy: { createdAt: 'desc' } },
                folder: true
            }
        });

        if (!asset) throw new Error("Processo não encontrado.");

        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true, role: true } });

        // O papel vem do token ou, sem ele, do banco, como no checkRole
        const effectiveRoles = roles.length > 0 ? roles : (user?.role ? [user.role] : []);
        const isAdminOrOperator = effectiveRoles.includes('ADMIN') || effectiveRoles.includes('OPERATOR');

        // Admin/Operator vê tudo — retorna direto
        if (isAdminOrOperator) return asset;

        if (!user) throw new Error("Acesso negado.");

        // Fecha o acesso direto por URL: as listagens já ocultam ativos sem dado
        // sincronizado, mas quem tivesse o link antigo ainda abriria o detalhe.
        if (UNSYNCED_STATUSES.includes(asset.status)) {
            throw new Error("Processo não encontrado.");
        }

        // Quem não é admin nem operador só abre o processo que acompanha: como cliente (investimento
        // dele) ou como associado (investimento de um cliente dele), seja qual for o papel
        const isLinkedAsAssociate = asset.investors.some(inv => inv.associate?.id === user.id);
        const isLinkedAsInvestor  = asset.investors.some(inv => inv.user?.id === user.id);
        if (!isLinkedAsAssociate && !isLinkedAsInvestor) throw new Error("Acesso negado.");
        const viewerIsAssociate = isLinkedAsAssociate && !isLinkedAsInvestor;

        // Dos investimentos, só os do próprio cliente e, para o associado, os dos clientes que ele
        // acompanha; o e-mail dos associados não vai (a tela usa o nome)
        const withoutEmail = (a: { id: string; name: string; email: string } | null) => a ? { id: a.id, name: a.name } : null;
        const investors = asset.investors
            .filter(inv => inv.user?.id === user.id || inv.associate?.id === user.id)
            .map(inv => ({ ...inv, associate: withoutEmail(inv.associate) }));
        const visible = { ...asset, investors, associate: withoutEmail(asset.associate) };

        // Associados não veem documentos
        if (viewerIsAssociate) return { ...visible, documents: [] };

        // Clientes veem:
        //  - docs globais (JURIDICO, PROCESSUAL) — investorUserId === null
        //  - docs privados (PRIVADO_FINANCEIRO) apenas os próprios — investorUserId === user.id
        const filteredDocs = asset.documents.filter(doc => {
            if (doc.section !== 'PRIVADO_FINANCEIRO') return true;
            return doc.investorUserId === user.id;
        });

        return { ...visible, documents: filteredDocs };
    }
}

export { GetAssetByProcessNumberUseCase };
