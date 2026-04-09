import { notificationService } from '../services/notificationService.js';
import { AppError } from '../utils/errors.js';

export const getNotifications = async (req, reply) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, unreadOnly, severity, type } = req.query;

        const data = await notificationService.getNotificationsForUser(userId, {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            unreadOnly: unreadOnly === 'true',
            severity,
            type
        });

        return reply.send({ success: true, data });
    } catch (error) {
        throw error;
    }
};

export const markAsRead = async (req, reply) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const notif = await notificationService.markAsRead(userId, id);
        if (!notif) {
            throw new AppError('Notification not found', 404);
        }

        return reply.send({ success: true, data: notif });
    } catch (error) {
        throw error;
    }
};

export const markAllAsRead = async (req, reply) => {
    try {
        const userId = req.user.id;
        await notificationService.markAllAsRead(userId);
        return reply.send({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        throw error;
    }
};

export const dismissNotification = async (req, reply) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        const result = await notificationService.dismiss(userId, id);
        if (!result) {
            throw new AppError('Notification not found', 404);
        }
        return reply.code(204).send();
    } catch (error) {
        throw error;
    }
};
