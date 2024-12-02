"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const refreshToken_routes_1 = require("./refreshToken.routes");
const welcome_routes_1 = require("./welcome.routes");
const users_routes_1 = require("./users.routes");
const investments_routes_1 = require("./investments.routes");
const userInvestments_routes_1 = require("./userInvestments.routes");
const notifications_routes_1 = require("./notifications.routes");
const investorProfile_routes_1 = require("./investorProfile.routes");
const auth0Check_1 = require("../modules/registrations/middleware/auth0Check");
// import { jwtCheck } from "../modules/registrations/middleware/auth0Check"
const router = (0, express_1.Router)();
exports.router = router;
router.use('/', welcome_routes_1.welcomeRoutes);
router.use('/investorProfile', auth0Check_1.checkJwtFromCookie, auth0Check_1.jwtCheck, investorProfile_routes_1.investorProfileRoutes);
router.use('/investments', auth0Check_1.checkJwtFromCookie, auth0Check_1.jwtCheck, investments_routes_1.investmentsRoutes);
router.use('/usersInvestments', auth0Check_1.checkJwtFromCookie, auth0Check_1.jwtCheck, userInvestments_routes_1.userInvestmentsRoutes);
router.use('/users', users_routes_1.usersRoutes);
router.use('/notifications', auth0Check_1.checkJwtFromCookie, auth0Check_1.jwtCheck, notifications_routes_1.notificationsRoutes);
router.use('/refresh-token', auth0Check_1.checkJwtFromCookie, auth0Check_1.jwtCheck, refreshToken_routes_1.refreshTokenRoutes);
router.get('/logintest', (req, res) => {
    return res.json({ success: true });
});
// mathfernando
// LL9i3EHl8M8NRvOn
