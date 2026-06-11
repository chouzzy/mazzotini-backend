import { prisma } from '../prisma';
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

const notificationsRoutes = Router();

// GET /api/notifications — lista paginada com filtros (somente ADMIN)
notificationsRoutes.get('/api/notifications', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const auth0UserId = (req as any).auth?.payload?.sub as string;
        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const page  = parseInt(req.query.page  as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip  = (page - 1) * limit;

        const { notificationType, status, from, to } = req.query as Record<string, string>;

        const where: any = {};
        if (notificationType && notificationType !== 'ALL') {
            where.notificationType = notificationType;
        }
        if (status === 'unread') {
            where.NOT = { readBy: { has: user.id } };
        } else if (status === 'read') {
            where.readBy = { has: user.id };
        }
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to)   where.createdAt.lte = new Date(to);
        }

        const [items, total] = await Promise.all([
            prisma.systemNotification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.systemNotification.count({ where }),
        ]);

        const itemsWithReadStatus = items.map(n => ({
            ...n,
            isRead: n.readBy.includes(user.id),
        }));

        return res.json({
            items: itemsWithReadStatus,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar notificações.' });
    }
});

// GET /api/notifications/unread-count — contagem de não lidas (somente ADMIN)
notificationsRoutes.get('/api/notifications/unread-count', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const auth0UserId = (req as any).auth?.payload?.sub as string;
        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const count = await prisma.systemNotification.count({
            where: { NOT: { readBy: { has: user.id } } },
        });

        return res.json({ count });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao contar notificações.' });
    }
});

// PATCH /api/notifications/read-all — marca todas como lidas (somente ADMIN)
notificationsRoutes.patch('/api/notifications/read-all', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const auth0UserId = (req as any).auth?.payload?.sub as string;
        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const unread = await prisma.systemNotification.findMany({
            where: { NOT: { readBy: { has: user.id } } },
            select: { id: true },
        });

        await Promise.all(
            unread.map(n =>
                prisma.systemNotification.update({
                    where: { id: n.id },
                    data: { readBy: { push: user.id } },
                })
            )
        );

        return res.json({ updated: unread.length });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao marcar notificações.' });
    }
});

// PATCH /api/notifications/:id/read — marca uma notificação como lida (somente ADMIN)
notificationsRoutes.patch('/api/notifications/:id/read', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const auth0UserId = (req as any).auth?.payload?.sub as string;
        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const { id } = req.params;
        const notification = await prisma.systemNotification.findUnique({ where: { id } });
        if (!notification) return res.status(404).json({ error: 'Notificação não encontrada.' });

        if (!notification.readBy.includes(user.id)) {
            await prisma.systemNotification.update({
                where: { id },
                data: { readBy: { push: user.id } },
            });
        }

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao marcar notificação.' });
    }
});

// PATCH /api/notifications/:id/unread — desmarca leitura (somente ADMIN)
notificationsRoutes.patch('/api/notifications/:id/unread', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const auth0UserId = (req as any).auth?.payload?.sub as string;
        const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const { id } = req.params;
        const notification = await prisma.systemNotification.findUnique({ where: { id } });
        if (!notification) return res.status(404).json({ error: 'Notificação não encontrada.' });

        await prisma.systemNotification.update({
            where: { id },
            data: { readBy: notification.readBy.filter(uid => uid !== user.id) },
        });

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao desmarcar notificação.' });
    }
});

// POST /api/notifications — cria notificação manual (somente ADMIN)
notificationsRoutes.post('/api/notifications', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const notification = await prisma.systemNotification.create({
            data: {
                title,
                message,
                type: type || 'info',
                notificationType: 'GENERAL',
                readBy: [],
            },
        });
        return res.status(201).json(notification);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao criar notificação.' });
    }
});

export { notificationsRoutes };
