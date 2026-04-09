/**
 * Dashboard Routes
 */

import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

export async function dashboardRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/dashboard/stats', (req, reply) => dashboardController.getStats(req, reply));
    app.get('/search', (req, reply) => dashboardController.search(req, reply));
}
