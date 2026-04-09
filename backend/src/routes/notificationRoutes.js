import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { connectedClients } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';
import config from '../core/config.js';

export default async function notificationRoutes(fastify, options) {
    // Standard CRUD REST APIs
    fastify.get('/notifications', { preHandler: [authenticate] }, notificationController.getNotifications);
    fastify.patch('/notifications/:id/read', { preHandler: [authenticate] }, notificationController.markAsRead);
    fastify.post('/notifications/mark-all-read', { preHandler: [authenticate] }, notificationController.markAllAsRead);
    fastify.delete('/notifications/:id', { preHandler: [authenticate] }, notificationController.dismissNotification);

    // WebSocket implementation
    fastify.get('/notifications/ws', { websocket: true }, (connection, req) => {
        // Authenticate WebSocket by token query parameter or header
        const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        
        if (!token) {
            connection.socket.close(1008, 'Token required');
            return;
        }

        try {
            const decoded = fastify.jwt.verify(token);
            const userId = decoded.id.toString();

            if (!connectedClients.has(userId)) {
                connectedClients.set(userId, new Set());
            }
            
            connectedClients.get(userId).add(connection.socket);
            logger.info(`WebSocket connected for user ${userId}`);

            connection.socket.on('close', () => {
                const clients = connectedClients.get(userId);
                if (clients) {
                    clients.delete(connection.socket);
                    if (clients.size === 0) {
                        connectedClients.delete(userId);
                    }
                }
                logger.info(`WebSocket disconnected for user ${userId}`);
            });
            
            // Setup ping-pong to keep connection alive
            connection.socket.on('pong', () => {
                connection.socket.isAlive = true;
            });

            // Heartbeat check interval setup 
            // We just let the client send basic messages 
            connection.socket.on('message', (message) => {
               if (message.toString() === 'ping') {
                   connection.socket.send('pong');
               }
            });

        } catch (error) {
            logger.error({ err: error }, 'WebSocket auth failed');
            connection.socket.close(1008, 'Invalid token');
        }
    });
}
