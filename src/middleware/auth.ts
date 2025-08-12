// src/middleware/auth.ts

import { auth } from 'express-oauth2-jwt-bearer';

// Configura o middleware para verificar o JWT
const checkJwt = auth({
  audience: [process.env.NEXT_PUBLIC_API_AUDIENCE as string],
  
  issuerBaseURL: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

export { checkJwt };
