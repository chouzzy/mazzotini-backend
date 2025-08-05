import { auth } from 'express-oauth2-jwt-bearer';

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE as string,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

export { checkJwt };