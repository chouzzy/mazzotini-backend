import { RefreshToken } from "@prisma/client"

class RefreshTokenEntity {
    
    id!: RefreshToken["id"]
    expires_at!: RefreshToken["expires_at"]
    usersID!: RefreshToken["usersID"]
}

export { RefreshTokenEntity }