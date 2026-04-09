/**
 * Auth Controller
 */

import { authService } from '../services/authService.js';
import { validate, registerSchema, loginSchema } from '../validators/schemas.js';

export class AuthController {
    async register(request, reply) {
        const data = validate(registerSchema, request.body);
        const result = await authService.register(data, request.server);
        return reply.status(201).send({
            success: true,
            message: 'User registered successfully',
            data: result,
        });
    }

    async login(request, reply) {
        const data = validate(loginSchema, request.body);
        const result = await authService.login(data.email, data.password, request.server, {
            ip: request.ip,
            userAgent: request.headers['user-agent'] || 'unknown',
        });
        return reply.send({
            success: true,
            message: 'Login successful',
            data: result,
        });
    }

    async refreshToken(request, reply) {
        const { refresh_token } = request.body;
        if (!refresh_token) {
            return reply.status(400).send({
                success: false,
                message: 'refresh_token is required',
            });
        }
        const result = await authService.refreshAccessToken(refresh_token, request.server);
        return reply.send({
            success: true,
            message: 'Token refreshed',
            data: result,
        });
    }

    async logout(request, reply) {
        const { refresh_token } = request.body;
        await authService.logout(refresh_token);
        return reply.send({
            success: true,
            message: 'Logged out successfully',
        });
    }

    async me(request, reply) {
        const user = await authService.getUserById(request.user.user_id);
        return reply.send({
            success: true,
            data: user,
        });
    }

    async updateProfile(request, reply) {
        const { full_name } = request.body || {};
        if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
            return reply.status(400).send({
                success: false,
                message: 'full_name must be at least 2 characters.',
            });
        }

        const User = (await import('../models/User.js')).default;
        const user = await User.findOneAndUpdate(
            { user_id: request.user.user_id },
            { full_name: full_name.trim() },
            { new: true }
        ).select('-password_hash -__v').lean();

        if (!user) {
            return reply.status(404).send({ success: false, message: 'User not found' });
        }

        return reply.send({
            success: true,
            message: 'Profile updated',
            data: user,
        });
    }
}

export const authController = new AuthController();
