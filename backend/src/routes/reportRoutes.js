/**
 * Report Routes
 */

import { reportController } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function reportRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/reports/evidence/:id', {
        preHandler: [requirePermission('report:view')],
    }, (req, reply) => reportController.generateEvidenceReport(req, reply));

    app.get('/reports/case/:id', {
        preHandler: [requirePermission('report:view')],
    }, (req, reply) => reportController.generateCaseReport(req, reply));

    app.get('/reports/audit', {
        preHandler: [requirePermission('report:view')],
    }, (req, reply) => reportController.generateAuditReport(req, reply));
}
