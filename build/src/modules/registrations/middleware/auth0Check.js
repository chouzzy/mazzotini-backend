"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkJwtFromCookie = exports.jwtCheck = void 0;
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const crypto_js_1 = __importDefault(require("crypto-js"));
const jwtCheck = (0, express_oauth2_jwt_bearer_1.auth)({
    audience: process.env.AUTH0_ISSUER_AUDIENCE_URL,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: 'RS256'
});
exports.jwtCheck = jwtCheck;
const checkJwtFromCookie = (req, res, next) => {
    const token = req.cookies.accessToken; // Extrai o token do cookie
    const secretKey = process.env.AUTH0_SECRET;
    if (!secretKey) {
        throw Error("Secret Key not found");
    }
    console.log('req.cookies');
    console.log(req.cookies);
    console.log('req.cookies.accessToken');
    console.log(req.cookies.accessToken);
    const encryptedToken = req.cookies.accessToken;
    const decryptedToken = crypto_js_1.default.AES.decrypt(encryptedToken, secretKey).toString(crypto_js_1.default.enc.Utf8);
    console.log('decryptedToken');
    console.log(decryptedToken);
    if (token) {
        req.headers.authorization = `Bearer ${decryptedToken}`; // Adiciona o token ao header
    }
    next(); // Chama a próxima middleware (jwtCheck)
};
exports.checkJwtFromCookie = checkJwtFromCookie;
