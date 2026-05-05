import { Router } from "express";
import { protectedRoutes } from "./protected.routes";
import { checkJwt } from "../middleware/auth"; // Importa o "segurança"
import { creditAssetRoutes } from "./creditAsset.routes";
import { userRoutes } from "./users.routes";
import { investmentRoutes } from "./investment.routes";
import { documentRoutes } from "./document.routes";
import { managementRoutes } from "./management.routes";
import { notificationsRoutes } from "./notifications.routes";
import { assetsRoutes } from "./assets.routes";
import { adminRoutes } from "./admin.routes";

const router = Router();



// Welcome route
router.get('/', (req, res) => res.json({ message: 'API Base está online!' }));

router.use(assetsRoutes);
router.use(creditAssetRoutes);
router.use(userRoutes);
router.use(investmentRoutes);
router.use(documentRoutes);
router.use(managementRoutes);
router.use(notificationsRoutes);
router.use(adminRoutes);

export { router };