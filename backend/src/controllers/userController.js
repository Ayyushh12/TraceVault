/**
 * User Controller — admin user listing
 */

import User from '../models/User.js';

export class UserController {
    async listUsers(request, reply) {
        const users = await User.find({})
            .select('-password_hash -public_key')
            .sort({ created_at: -1 })
            .lean();

        return reply.send({
            success: true,
            data: {
                users,
                total: users.length,
            },
        });
    }
}

export const userController = new UserController();
