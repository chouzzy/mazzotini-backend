import { Request, Response } from "express"
import { RefreshTokenEntity } from "../../entities/RefreshToken"
import { RefreshTokenUseCase } from "./RefreshTokenUseCase"
import { RefreshTokenRepository } from "../../repositories/implementations/RefreshTokenRepository"

interface RefreshTokenRequestProps {
    id: RefreshTokenEntity["id"]
 }


class RefreshTokenController {
    async handle(req: Request, res: Response): Promise<Response> {

        const refreshToken: RefreshTokenRequestProps = req.body

        /// instanciação da classe do caso de uso
        const refreshTokenRepository = new RefreshTokenRepository()
        const refreshTokenUseCase = new RefreshTokenUseCase(refreshTokenRepository)

        //NewTokens pode conter o token e/ou refreshtoken
        const newTokens = await refreshTokenUseCase.execute(refreshToken)

        ///
        // const tokenIsValid = await ErrorValidation(newTokens)
        
        if (newTokens.isValid === false) {
            return res.status(newTokens.statusCode).json({
                errorMessage: newTokens.errorMessage
            })
        }

        if (newTokens.refreshToken) {
            const {token, refreshToken} = newTokens

            return res.status(202).json({
                token,
                refreshToken
            })
        }

        return res.status(202).json({
            token: newTokens.token
        })

    }
}

export { RefreshTokenController, RefreshTokenRequestProps }