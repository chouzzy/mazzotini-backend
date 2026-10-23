import { prisma } from '../../../../prisma';
import { isApprovedAccount } from '../../../../utils/accountStatus';
// /src/modules/users/useCases/getMyProfile/GetMyProfileUseCase.ts




class GetMyProfileUseCase {
    async execute(auth0UserId: string) {
        console.log(`[PROFILE] A buscar perfil para o utilizador: ${auth0UserId}`);
        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            // =================================================================
            //  A MUDANÇA: Incluindo os investimentos e dados básicos do ativo
            // =================================================================
            include: {
                investments: {
                    include: {
                        asset: {
                            select: {
                                id: true,
                                processNumber: true,
                                nickname: true,
                                status: true
                            }
                        }
                    }
                }
            }
            // =================================================================
        });
        // Conta ainda não aprovada: o próprio cadastro, sem os investimentos. Os processos e os
        // anexos da carteira só aparecem depois da aprovação, como nas rotas com dados de cliente
        // (requireApprovedAccount). O onboarding e a tela de espera não usam esse campo
        if (user && !isApprovedAccount(user.status)) return { ...user, investments: [] };
        return user;
    }
}

export { GetMyProfileUseCase };
