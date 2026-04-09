/**
 * Evidence Routes
 */

import { evidenceController } from '../controllers/evidenceController.js';
import { forensicAnalysisController } from '../controllers/forensicAnalysisController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function evidenceRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.post('/evidence/upload', {
        preHandler: [requirePermission('evidence:upload')],
    }, (req, reply) => evidenceController.upload(req, reply));

    app.get('/evidence', {
        preHandler: [requirePermission('evidence:view')],
    }, (req, reply) => evidenceController.list(req, reply));

    app.get('/evidence/:id', {
        preHandler: [requirePermission('evidence:view')],
    }, (req, reply) => evidenceController.getById(req, reply));

    app.get('/evidence/:id/download', {
        preHandler: [requirePermission('evidence:download')],
    }, (req, reply) => evidenceController.download(req, reply));

    app.post('/evidence/:id/sign', {
        preHandler: [requirePermission('evidence:sign')],
    }, (req, reply) => evidenceController.sign(req, reply));

    app.post('/evidence/:id/lock', {
        preHandler: [requirePermission('evidence:upload')], // investigator/admin level
    }, (req, reply) => evidenceController.lock(req, reply));

    app.post('/evidence/:id/unlock', {
        preHandler: [authenticate]
    }, (req, reply) => evidenceController.unlock(req, reply));

    app.post('/evidence/:id/transfer', {
        preHandler: [authenticate]
    }, (req, reply) => evidenceController.transfer(req, reply));

    app.put('/evidence/:id', {
        preHandler: [requirePermission('evidence:upload')], // investigator level
    }, (req, reply) => evidenceController.update(req, reply));

    app.get('/evidence/:id/preview', {
        preHandler: [requirePermission('evidence:view')],
    }, (req, reply) => evidenceController.preview(req, reply));

    app.get('/evidence/:id/analyze', {
        preHandler: [requirePermission('evidence:view')],
    }, (req, reply) => forensicAnalysisController.analyzeEvidence(req, reply));

    app.post('/evidence/bulk', {
        preHandler: [requirePermission('evidence:upload')],
    }, (req, reply) => evidenceController.bulkAction(req, reply));

    app.get('/evidence/:id/versions', {
        preHandler: [requirePermission('evidence:view')],
    }, (req, reply) => evidenceController.getVersions(req, reply));
}
