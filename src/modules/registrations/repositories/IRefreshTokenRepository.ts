import { validationResponse } from "../../../types";
import { RefreshTokenRequestProps } from "../useCases/refreshToken/RefreshTokenController";


interface IRefreshTokenRepository {

    refreshTokenValidation(refreshToken: RefreshTokenRequestProps): Promise<validationResponse>
}

export {IRefreshTokenRepository}