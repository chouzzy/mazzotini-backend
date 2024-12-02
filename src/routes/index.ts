import { Router } from "express"
import { refreshTokenRoutes } from "./refreshToken.routes"
import { welcomeRoutes } from "./welcome.routes"
import { usersRoutes } from "./users.routes"
import { investmentsRoutes } from "./investments.routes"
import { userInvestmentsRoutes } from "./userInvestments.routes"
import { notificationsRoutes } from "./notifications.routes"
import { investorProfileRoutes } from "./investorProfile.routes"
import { checkJwtFromCookie, jwtCheck } from "../modules/registrations/middleware/auth0Check"
// import { jwtCheck } from "../modules/registrations/middleware/auth0Check"

const router = Router()

router.use('/',  welcomeRoutes)

router.use('/investorProfile', checkJwtFromCookie, jwtCheck,  investorProfileRoutes)

router.use('/investments', checkJwtFromCookie, jwtCheck,  investmentsRoutes)

router.use('/usersInvestments', checkJwtFromCookie, jwtCheck,  userInvestmentsRoutes)

router.use('/users', usersRoutes)

router.use('/notifications', checkJwtFromCookie, jwtCheck, notificationsRoutes)

router.use('/refresh-token', checkJwtFromCookie, jwtCheck, refreshTokenRoutes)

router.get('/logintest', (req, res) => {
    return res.json({ success: true })
})



export { router }
// mathfernando
// LL9i3EHl8M8NRvOn