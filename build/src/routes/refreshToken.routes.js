"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenRoutes = void 0;
const express_1 = require("express");
const RefreshTokenController_1 = require("../modules/registrations/useCases/refreshToken/RefreshTokenController");
const refreshTokenRoutes = (0, express_1.Router)();
exports.refreshTokenRoutes = refreshTokenRoutes;
const refreshTokenController = new RefreshTokenController_1.RefreshTokenController();
refreshTokenRoutes.post('/', refreshTokenController.handle);
