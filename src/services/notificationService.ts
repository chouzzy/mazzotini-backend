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

export async function notifyAllAdmins(opts: CreateNotificationOptions): Promise<void> {
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
    } catch (err) {
        console.error('[NotificationService] Falha ao criar notificação:', err);
    }
}
