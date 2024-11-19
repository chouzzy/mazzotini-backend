"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAuthenticated = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
function ensureAuthenticated(req, res, next) {
    const authToken = req.headers.authorization;
    if (!authToken) {
        return res.status(401).json({
            errorMessage: 'Nenhum header token foi enviado'
        });
    }
    const [, token] = authToken.split(" ");
    if (!token) {
        return res.status(401).json({
            errorMessage: 'Token is missing'
        });
    }
    try {
        const privateKey = process.env.TOKEN_PRIVATE_KEY;
        (0, jsonwebtoken_1.verify)(token, privateKey ? privateKey : '');
        return next();
    }
    catch (error) {
        return res.status(401).json({
            errorMessage: 'Token is invalid'
        });
    }
}
exports.ensureAuthenticated = ensureAuthenticated;
