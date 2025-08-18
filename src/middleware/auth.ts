// src/middleware/auth.ts

import { auth } from 'express-oauth2-jwt-bearer';

// Configura o middleware para verificar o JWT
const checkJwt = auth({
  // MUDANÇA: Removido o prefixo 'NEXT_PUBLIC_' e renomeado para corresponder ao ecosystem.config.js
  audience: process.env.AUTH0_AUDIENCE as string,
  
  // MUDANÇA: Removido o prefixo 'NEXT_PUBLIC_'
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  
  tokenSigningAlg: 'RS256'
});

export { checkJwt };