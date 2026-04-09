/**
 * User Routes — admin-only user management
 */

import { userController } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function userRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/users', {
        preHandler: [requirePermission('user:manage')],
    }, (req, reply) => userController.listUsers(req, reply));
}
