import { prisma } from '../prisma';

interface CreateNotificationOptions {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    notificationType?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    relatedEntityName?: string;
    link?: string;
}

/**
 * Cria a notificação para os admins. Não lança: devolve false se não conseguiu gravar, para quem
 * precisa marcar que avisou (e não marcar quando o aviso não saiu).
 */
export async function notifyAllAdmins(opts: CreateNotificationOptions): Promise<boolean> {
    try {
        await prisma.systemNotification.create({
            data: {
                title: opts.title,
                message: opts.message,
                type: opts.type ?? 'info',
                notificationType: opts.notificationType ?? 'GENERAL',
                relatedEntityId: opts.relatedEntityId,
                relatedEntityType: opts.relatedEntityType,
                relatedEntityName: opts.relatedEntityName,
                link: opts.link,
                readBy: [],
            },
        });
        return true;
    } catch (err) {
        console.error('[NotificationService] Falha ao criar notificação:', err);
        return false;
    }
}
