/**
 * notifications.routes.ts — Rotas de Notificações do Sistema
 *
 * Notificações são mensagens globais exibidas no painel para todos os usuários logados.
 * Admins podem criar novas notificações (avisos, alertas, comunicados).
 * A listagem retorna as 10 mais recentes em ordem cronológica decrescente.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

const notificationsRoutes = Router();
const prisma = new PrismaClient();


/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lista as últimas notificações do sistema
 *     description: Retorna as 10 notificações mais recentes, ordenadas da mais nova para a mais antiga.
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificações
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemNotification'
 */
notificationsRoutes.get('/api/notifications', checkJwt, async (req, res) => {
    try {
        const notifications = await prisma.systemNotification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10, // Últimas 10 notificações
        });
        return res.json(notifications);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar notificações.' });
    }
});

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Cria uma nova notificação global (apenas ADMIN)
 *     description: |
 *       Publica uma notificação que será exibida para todos os usuários do painel.
 *       O `type` controla a cor do badge: info (azul), success (verde), warning (amarelo), error (vermelho).
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title:   { type: string, example: 'Manutenção programada' }
 *               message: { type: string, example: 'O sistema estará em manutenção às 22h.' }
 *               type:    { type: string, enum: [info, success, warning, error], default: info }
 *               link:    { type: string, format: uri, nullable: true }
 *     responses:
 *       201:
 *         description: Notificação criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemNotification'
 */
notificationsRoutes.post('/api/notifications', checkJwt, checkRole(['ADMIN']), async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const notification = await prisma.systemNotification.create({
            data: { title, message, type: type || 'info' },
        });
        return res.status(201).json(notification);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao criar notificação.' });
    }
});

export { notificationsRoutes };
