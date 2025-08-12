import { Router } from "express";
import { protectedRoutes } from "./protected.routes";
import { checkJwt } from "../middleware/auth"; // Importa o "segurança"
import { creditAssetRoutes } from "./creditAsset.routes";

const router = Router();

// Rota pública de boas-vindas
router.get('/', (req, res) => res.json({ message: 'API Base está online!' }));

// Usa o roteador de rotas protegidas, aplicando o middleware de segurança
router.use('/api', checkJwt, protectedRoutes);

router.use(creditAssetRoutes); // 2. Use

export { router };