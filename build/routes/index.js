"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const refreshToken_routes_1 = require("./refreshToken.routes");
const welcome_routes_1 = require("./welcome.routes");
const users_routes_1 = require("./users.routes");
const investments_routes_1 = require("./investments.routes");
const userInvestments_routes_1 = require("./userInvestments.routes");
const router = (0, express_1.Router)();
exports.router = router;
//donations routes
router.use('/', welcome_routes_1.welcomeRoutes);
router.use('/investments', investments_routes_1.investmentsRoutes);
router.use('/usersInvestments', userInvestments_routes_1.userInvestmentsRoutes);
router.use('/users', users_routes_1.usersRoutes);
router.use('/refresh-token', refreshToken_routes_1.refreshTokenRoutes);
router.get('/logintest', (req, res) => {
    return res.json({ success: true });
});
// mathfernando
// LL9i3EHl8M8NRvOn
