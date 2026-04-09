/**
 * Verification Routes
 */

import { verificationController } from '../controllers/verificationController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function verificationRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/evidence/:id/verify', {
        preHandler: [requirePermission('evidence:verify')],
    }, (req, reply) => verificationController.verifyEvidence(req, reply));

    app.get('/evidence/:id/validate-chain', {
        preHandler: [requirePermission('evidence:verify')],
    }, (req, reply) => verificationController.validateChain(req, reply));
}
