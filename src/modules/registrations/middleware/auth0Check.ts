import { NextFunction, Request, Response } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import CryptoJS from 'crypto-js';

const jwtCheck = auth({
  audience: process.env.AUTH0_ISSUER_AUDIENCE_URL,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

const checkJwtFromCookie = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken; // Extrai o token do cookie

  const secretKey = process.env.AUTH0_SECRET;

  if (!secretKey) {
    throw Error("Secret Key not found")
  }

  console.log('req.cookies')
  console.log(req.cookies)

  console.log('req.cookies.accessToken')
  console.log(req.cookies.accessToken)

  const encryptedToken = req.cookies.accessToken;
  const decryptedToken = CryptoJS.AES.decrypt(encryptedToken, secretKey).toString(CryptoJS.enc.Utf8);
  console.log('decryptedToken')
  console.log(decryptedToken)

  if (token) {
    req.headers.authorization = `Bearer ${decryptedToken}`; // Adiciona o token ao header
  }
  next(); // Chama a próxima middleware (jwtCheck)
};



export { jwtCheck, checkJwtFromCookie };
