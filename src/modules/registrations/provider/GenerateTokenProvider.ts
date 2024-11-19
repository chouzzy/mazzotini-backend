import { sign } from "jsonwebtoken"
import { validationResponse } from "../../../types"
import { UsersEntity } from "../entities/Users"


class GenerateTokenProvider {

    async execute(usersID: UsersEntity["id"]): Promise<validationResponse["token"]> {

        const privateKey = process.env.TOKEN_PRIVATE_KEY
        
        const payload = JSON.stringify({
            id: usersID,
        })

        const token = sign({payload}, privateKey?privateKey:'', {
            
            subject: usersID,
            expiresIn: "1d"
        })

        return token
    }
}

export { GenerateTokenProvider }