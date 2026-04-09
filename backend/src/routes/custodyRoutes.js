/**
 * Custody Routes
 */

import { custodyController } from '../controllers/custodyController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function custodyRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.post('/custody/transfer', {
        preHandler: [requirePermission('custody:transfer')],
    }, (req, reply) => custodyController.transfer(req, reply));

    app.get('/evidence/:id/timeline', {
        preHandler: [requirePermission('custody:view')],
    }, (req, reply) => custodyController.getTimeline(req, reply));

    app.get('/evidence/:id/chain', {
        preHandler: [requirePermission('custody:view')],
    }, (req, reply) => custodyController.getCustodyChain(req, reply));

    app.get('/evidence/:id/verify-chain', {
        preHandler: [requirePermission('custody:verify')],
    }, (req, reply) => custodyController.verifyChain(req, reply));
}
