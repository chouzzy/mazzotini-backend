import dayjs from "dayjs";
import { prisma } from "../../../prisma";
import { RefreshTokenEntity } from "../entities/RefreshToken";


class GenerateRefreshToken {

    async execute(usersID: RefreshTokenEntity["usersID"]): Promise<RefreshTokenEntity> {

        const expTimeNumber = Number(process.env.REFRESHTOKEN_EXPIRATION_TIME_NUMBER)
        // const expTimeUnit = process.env.REFRESHTOKEN_EXPIRATION_TIME_UNIT

        const expires_at = dayjs().add(expTimeNumber, 'days').unix();

        const generateRefreshToken = await prisma.refreshToken.create({
            data: {
                usersID,
                expires_at
            }
        })

        return generateRefreshToken
    }
}

export { GenerateRefreshToken }