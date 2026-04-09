/**
 * Case Routes
 */

import { caseController } from '../controllers/caseController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function caseRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.post('/cases', {
        preHandler: [requirePermission('case:create')],
    }, (req, reply) => caseController.createCase(req, reply));

    app.get('/cases', {
        preHandler: [requirePermission('case:view')],
    }, (req, reply) => caseController.getCases(req, reply));

    app.get('/cases/stats', {
        preHandler: [requirePermission('case:view')],
    }, (req, reply) => caseController.getStats(req, reply));

    app.get('/cases/:id', {
        preHandler: [requirePermission('case:view')],
    }, (req, reply) => caseController.getCaseById(req, reply));

    app.put('/cases/:id', {
        preHandler: [requirePermission('case:update')],
    }, (req, reply) => caseController.updateCase(req, reply));

    app.delete('/cases/:id', {
        preHandler: [requirePermission('case:delete')],
    }, (req, reply) => caseController.deleteCase(req, reply));

    app.post('/cases/:id/notes', {
        preHandler: [requirePermission('case:update')],
    }, (req, reply) => caseController.addNote(req, reply));

    app.get('/cases/:id/report', {
        preHandler: [requirePermission('case:view')],
    }, (req, reply) => caseController.generateReport(req, reply));

    app.get('/cases/:id/export', {
        preHandler: [requirePermission('case:view')],
    }, (req, reply) => caseController.generateExport(req, reply));
}
