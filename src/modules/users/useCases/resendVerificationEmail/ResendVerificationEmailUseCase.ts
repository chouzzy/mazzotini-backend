// /src/modules/users/useCases/resendVerificationEmail/ResendVerificationEmailUseCase.ts
import { auth0ManagementService } from "../../../../services/auth0ManagementService";

class ResendVerificationEmailUseCase {
    async execute(auth0UserId: string): Promise<void> {
        await auth0ManagementService.resendVerificationEmail(auth0UserId);
    }
}

export { ResendVerificationEmailUseCase };
