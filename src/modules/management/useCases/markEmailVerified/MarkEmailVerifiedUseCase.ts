import { auth0ManagementService } from "../../../../services/auth0ManagementService";

class MarkEmailVerifiedUseCase {
    async execute(auth0UserId: string): Promise<void> {
        await auth0ManagementService.markEmailVerified(auth0UserId);
    }
}

export { MarkEmailVerifiedUseCase };
