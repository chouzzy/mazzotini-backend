import { Router } from "express"
import { refreshTokenRoutes } from "./refreshToken.routes"
import { welcomeRoutes } from "./welcome.routes"
import { usersRoutes } from "./users.routes"
import { investmentsRoutes } from "./investments.routes"
import { userInvestmentsRoutes } from "./userInvestments.routes"
import { notificationsRoutes } from "./notifications.routes"
import { investorProfileRoutes } from "./investorProfile.routes"
// import { jwtCheck } from "../modules/registrations/middleware/auth0Check"

const router = Router()

//donations routes
router.use('/', welcomeRoutes)

router.use('/investorProfile', investorProfileRoutes)

router.use('/investments', investmentsRoutes)

router.use('/usersInvestments', userInvestmentsRoutes)

router.use('/users', usersRoutes)

router.use('/notifications', notificationsRoutes)

router.use('/refresh-token', refreshTokenRoutes)

router.get('/logintest', (req, res) => {
    return res.json({ success: true })
})



export { router }
// mathfernando
// LL9i3EHl8M8NRvOn