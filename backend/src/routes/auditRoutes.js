/**
 * Audit Routes
 */

import { auditController } from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function auditRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/audit/logs', {
        preHandler: [requirePermission('audit:view')],
    }, (req, reply) => auditController.getLogs(req, reply));

    app.get('/audit/stats', {
        preHandler: [requirePermission('audit:view')],
    }, (req, reply) => auditController.getStats(req, reply));

    app.get('/audit/analytics', {
        preHandler: [requirePermission('audit:view')],
    }, (req, reply) => auditController.getAnalytics(req, reply));
}
