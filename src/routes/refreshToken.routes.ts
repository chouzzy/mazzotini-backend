import { Router } from "express"
import { RefreshTokenController } from "../modules/registrations/useCases/refreshToken/RefreshTokenController"

const refreshTokenRoutes = Router()

const refreshTokenController = new RefreshTokenController()
refreshTokenRoutes.post('/', refreshTokenController.handle)


export {refreshTokenRoutes}