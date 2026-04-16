import { auth0ManagementService } from "../../../../services/auth0ManagementService";

class PasswordResetUseCase {
    async execute(auth0UserId: string): Promise<string> {
        return auth0ManagementService.generatePasswordResetLink(auth0UserId);
    }
}

export { PasswordResetUseCase };
