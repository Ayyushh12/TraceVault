/**
 * Auth Routes
 */

import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

export async function authRoutes(app) {
    // Public routes
    app.post('/auth/register', (req, reply) => authController.register(req, reply));
    app.post('/auth/login', (req, reply) => authController.login(req, reply));
    app.post('/auth/refresh', (req, reply) => authController.refreshToken(req, reply));

    // Protected routes
    app.post('/auth/logout', {
        preHandler: [authenticate],
    }, (req, reply) => authController.logout(req, reply));

    app.get('/auth/me', {
        preHandler: [authenticate],
    }, (req, reply) => authController.me(req, reply));

    // Profile update (self-service)
    app.patch('/auth/profile', {
        preHandler: [authenticate],
    }, (req, reply) => authController.updateProfile(req, reply));
}
