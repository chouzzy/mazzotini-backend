import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

const notificationsRoutes = Router();
const prisma = new PrismaClient();

// 1. Listar últimas notificações (Para todos os logados)
notificationsRoutes.get('/api/notifications', checkJwt, async (req, res) => {
    try {
        const notifications = await prisma.systemNotification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10 // Pega as 10 últimas
        });
        return res.json(notifications);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar notificações." });
    }
});

// 2. Criar nova notificação (Só Admin)
// Payload: { "title": "Novidade!", "message": "...", "type": "success" }
notificationsRoutes.post('/api/notifications', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const notification = await prisma.systemNotification.create({
            data: { title, message, type: type || 'info' }
        });
        return res.status(201).json(notification);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao criar notificação." });
    }
});

export { notificationsRoutes };