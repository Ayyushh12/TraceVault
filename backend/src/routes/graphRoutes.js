import { graphController } from '../controllers/graphController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

export async function graphRoutes(app) {
    app.addHook('preHandler', authenticate);

    // Endpoint for relationship mapping graph
    app.get('/threat-intel/graph', {
        preHandler: [requirePermission('threat:view')],
    }, (req, reply) => graphController.getGraphData(req, reply));
}
