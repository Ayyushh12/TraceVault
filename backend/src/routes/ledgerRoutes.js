/**
 * Ledger Routes
 */

import { ledgerController } from '../controllers/ledgerController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function ledgerRoutes(app) {
    app.addHook('preHandler', authenticate);

    app.get('/ledger/anchor', {
        preHandler: [requirePermission('ledger:view')],
    }, (req, reply) => ledgerController.getLatestAnchor(req, reply));

    app.get('/ledger/anchors', {
        preHandler: [requirePermission('ledger:view')],
    }, (req, reply) => ledgerController.getAnchors(req, reply));

    app.get('/ledger/anchor/:date', {
        preHandler: [requirePermission('ledger:view')],
    }, (req, reply) => ledgerController.getAnchorByDate(req, reply));

    app.get('/ledger/verify', {
        preHandler: [requirePermission('ledger:view')],
    }, (req, reply) => ledgerController.verifyAnchorChain(req, reply));
}
