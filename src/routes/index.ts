import { Router } from "express";
import { protectedRoutes } from "./protected.routes";
import { checkJwt } from "../middleware/auth"; // Importa o "segurança"
import { creditAssetRoutes } from "./creditAsset.routes";
import { userRoutes } from "./users.routes";
import { investmentRoutes } from "./investment.routes";
import { documentRoutes } from "./document.routes";
import { managementRoutes } from "./management.routes";

const router = Router();

// Rota pública de boas-vindas
router.get('/', (req, res) => res.json({ message: 'API Base está online!' }));

// // Usa o roteador de rotas protegidas, aplicando o middleware de segurança
// router.use('/api', checkJwt, protectedRoutes);

router.use(creditAssetRoutes);
router.use(userRoutes);
router.use(investmentRoutes);
router.use(documentRoutes);
router.use(managementRoutes);


export { router };