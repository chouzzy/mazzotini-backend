import { Router } from "express";
import { protectedRoutes } from "./protected.routes";
import { checkJwt } from "../middleware/auth"; // Importa o "segurança"

const router = Router();

// Rota pública de boas-vindas
router.get('/', (req, res) => res.json({ message: 'API Base está online!' }));

// Usa o roteador de rotas protegidas, aplicando o middleware de segurança
router.use('/api', checkJwt, protectedRoutes);

export { router };