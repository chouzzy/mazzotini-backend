import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "../../../../prisma";
import { validationResponse } from "../../../../types";
import { RefreshTokenEntity } from "../../entities/RefreshToken";
import { GenerateRefreshToken } from "../../provider/GenerateRefreshToken";
import { GenerateTokenProvider } from "../../provider/GenerateTokenProvider";
import { IRefreshTokenRepository } from "../IRefreshTokenRepository";
import { RefreshTokenRequestProps } from "../../useCases/refreshToken/RefreshTokenController";


class RefreshTokenRepository implements IRefreshTokenRepository {

    private refreshToken: RefreshTokenEntity[]

    constructor() {
        this.refreshToken = []
    }

    async refreshTokenValidation(refreshToken: RefreshTokenRequestProps): Promise<validationResponse> {

        try {

            const usersRefreshToken = await prisma.refreshToken.findFirst({
                where: {
                    id: refreshToken.id
                }
            })

            if (!usersRefreshToken) {
                return { isValid: false, errorMessage: "Refresh Token inválido", statusCode: 401 }
            }

            // const usersFound = await prisma.users.findFirst({
            //     where: {
            //         id: usersRefreshToken.usersID
            //     }
            // })

            // if (!usersFound) {
            //     return { isValid: false, errorMessage: "Refresh Token inválido", statusCode: 401 }
            // }

            const refreshTokenExpired = dayjs().isAfter(dayjs.unix(usersRefreshToken.expires_at))

            if (refreshTokenExpired) {

                await prisma.refreshToken.deleteMany({
                    where: {
                        usersID: usersRefreshToken.usersID
                    }
                })
                return { isValid: false, errorMessage: "Refresh Token inválido", statusCode: 401 }
            }

            await prisma.refreshToken.deleteMany({
                where: {
                    usersID: usersRefreshToken.usersID
                }
            })

            //gera novo access token
            const generateTokenProvider = new GenerateTokenProvider()
            const token = await generateTokenProvider.execute(usersRefreshToken.usersID)

            //apagar o refresh token e enviar um 401 refresh token expired
            const generateRefreshToken = new GenerateRefreshToken()
            const newRefreshToken = await generateRefreshToken.execute(usersRefreshToken.usersID)

            return {
                isValid: true,
                token: token,
                refreshToken: newRefreshToken.id,
                // users: {
                //     id: usersFound.id,
                //     name: usersFound.name,
                //     username: usersFound.username,
                //     email: usersFound.email,
                // },
                statusCode: 202
            }



        } catch (error) {
            // if (error instanceof Prisma.PrismaClientValidationError) {

            //     const argumentPosition = error.message.search('Argument')
            //     const mongoDBError = error.message.slice(argumentPosition)
            //     return { isValid: false, errorMessage: mongoDBError, statusCode: 403 }

            // } else {
                return { isValid: false, errorMessage: String(error), statusCode: 403 }
            // }
        }
    }
}

export { RefreshTokenRepository }