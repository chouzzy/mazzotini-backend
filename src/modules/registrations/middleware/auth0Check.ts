import { NextFunction, Request, Response } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import CryptoJS from 'crypto-js';

const jwtCheck = auth({
  audience: process.env.AUTH0_ISSUER_AUDIENCE_URL,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

const checkJwtFromCookie = (req: Request, res: Response, next: NextFunction) => {

  try {

    const bearerToken = req.headers.authorization; // Extrai o token do cookie
    console.log('bearerToken')
    console.log(bearerToken)
    if (!bearerToken) {
      throw Error("Token não encontrado")
    }


    // const secretKey = process.env.AUTH0_SECRET;

    // if (!secretKey) {
    //   throw Error("Secret Key not found")
    // }

    // console.log('accessTokenCheck')
    const accessToken = bearerToken.split(' ')[1]
    // console.log('accessToken')
    // console.log(accessToken)


    req.headers.authorization = `Bearer ${accessToken}`; // Adiciona o token ao header
    next(); // Chama a próxima middleware (jwtCheck)

  } catch (error) {
    console.error("Erro ao descriptografar o token:", error);
    return res.status(401).json({ message: 'Token inválido' });
  }
};



export { jwtCheck, checkJwtFromCookie };
