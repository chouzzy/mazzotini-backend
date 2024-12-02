"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkJwtFromCookie = exports.jwtCheck = void 0;
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const jwtCheck = (0, express_oauth2_jwt_bearer_1.auth)({
    audience: process.env.AUTH0_ISSUER_AUDIENCE_URL,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: 'RS256'
});
exports.jwtCheck = jwtCheck;
const checkJwtFromCookie = (req, res, next) => {
    try {
        const bearerToken = req.headers.authorization; // Extrai o token do cookie
        console.log('bearerToken');
        console.log(bearerToken);
        if (!bearerToken) {
            throw Error("Token não encontrado");
        }
        // const secretKey = process.env.AUTH0_SECRET;
        // if (!secretKey) {
        //   throw Error("Secret Key not found")
        // }
        // console.log('accessTokenCheck')
        const accessToken = bearerToken.split(' ')[1];
        // console.log('accessToken')
        // console.log(accessToken)
        req.headers.authorization = `Bearer ${accessToken}`; // Adiciona o token ao header
        next(); // Chama a próxima middleware (jwtCheck)
    }
    catch (error) {
        console.error("Erro ao descriptografar o token:", error);
        return res.status(401).json({ message: 'Token inválido' });
    }
};
exports.checkJwtFromCookie = checkJwtFromCookie;
