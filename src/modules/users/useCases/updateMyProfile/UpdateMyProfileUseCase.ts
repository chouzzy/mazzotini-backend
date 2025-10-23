// /src/modules/users/useCases/updateMyProfile/UpdateMyProfileUseCase.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A interface agora reflete todos os novos campos do schema.prisma
// Esta é a "lista branca" de campos que permitimos que o utilizador atualize.
// CORREÇÃO: Adicionado '| null' a todos os campos opcionais para corresponder ao schema de validação.
interface IRequestData {
    name?: string;
    cpfOrCnpj?: string;
    rg?: string | null;
    birthDate?: Date | null;
    profession?: string | null;
    contactPreference?: string | null;
    infoEmail?: string | null;
    
    residentialCep?: string;
    residentialStreet?: string;
    residentialNumber?: string;
    residentialComplement?: string | null;
    residentialNeighborhood?: string;
    residentialCity?: string;
    residentialState?: string;

    commercialCep?: string | null;
    commercialStreet?: string | null;
    commercialNumber?: string | null;
    commercialComplement?: string | null;
    commercialNeighborhood?: string | null;
    commercialCity?: string | null;
    commercialState?: string | null;
    
    correspondenceAddress?: string | null;
    
    phone?: string | null;
    cellPhone?: string;
    nationality?: string | null;
    maritalStatus?: string | null;
    referredById?: string | null; // O ID do Associado (vendedor) que o indicou
}

interface IRequest {
    auth0UserId: string;
    data: IRequestData;
}

class UpdateMyProfileUseCase {
    async execute({ auth0UserId, data }: IRequest): Promise<void> {
        console.log(`[PROFILE] A atualizar perfil para o utilizador: ${auth0UserId}`);

        // O 'address' antigo é depreciado e não será usado.
        const { address, ...validData } = data as any;

        const existingUser = await prisma.user.findUnique({
            where: { auth0UserId },
        });

        const updateData: any = {
            ...validData,
        };

        if (!existingUser || existingUser.status !== "ACTIVE") {
            // Ao completar o perfil, o status muda para aguardar a revisão do Admin.
            updateData.status = "PENDING_REVIEW";
        }

        await prisma.user.update({
            where: { auth0UserId },
            data: updateData,
        });

        console.log(`[PROFILE] Perfil de ${auth0UserId} atualizado.`);
        if (!existingUser || existingUser.status !== "ACTIVE") {
            console.log(`[PROFILE] Perfil de ${auth0UserId} movido para 'PENDING_REVIEW'.`);
        }
    }
}

export { UpdateMyProfileUseCase };

