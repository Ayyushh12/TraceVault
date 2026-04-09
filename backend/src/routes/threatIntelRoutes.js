/**
 * Threat Intelligence Routes
 */

import { threatIntelController } from '../controllers/threatIntelController.js';
import { graphController } from '../controllers/graphController.js';
import { authenticate } from '../middleware/auth.js';

export async function threatIntelRoutes(app) {
    app.addHook('onRequest', authenticate);

    app.get('/threat-intel/dashboard', threatIntelController.getDashboard);
    app.get('/threat-intel/evidence/:id', threatIntelController.getEvidenceRisk);
    app.get('/threat-intel/case/:id', threatIntelController.getCaseThreat);
    app.get('/threat-intel/anomalies', threatIntelController.getAnomalies);
    app.get('/threat-intel/duplicates', threatIntelController.getDuplicates);

    // Relationship graph
    app.get('/threat-intel/graph', (req, reply) => graphController.getGraphData(req, reply));
}
