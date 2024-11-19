import { validationResponse } from "../../../../types";
import { IRefreshTokenRepository } from "../../repositories/IRefreshTokenRepository";
import { RefreshTokenRequestProps } from "./RefreshTokenController";


class RefreshTokenUseCase {
    constructor(
        private refreshTokensRepository: IRefreshTokenRepository) { }

    async execute(refreshToken: RefreshTokenRequestProps): Promise< validationResponse> {

        const token = await this.refreshTokensRepository.refreshTokenValidation(refreshToken)

        return token
    }

}

export { RefreshTokenUseCase }