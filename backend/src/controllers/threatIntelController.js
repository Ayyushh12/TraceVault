/**
 * Threat Intelligence Controller
 *
 * Endpoints:
 *   GET  /threat-intel/dashboard    → Full threat dashboard data
 *   GET  /threat-intel/evidence/:id → Risk score for specific evidence
 *   GET  /threat-intel/case/:id     → Threat assessment for a case
 *   GET  /threat-intel/anomalies    → Anomaly detection results
 *   GET  /threat-intel/duplicates   → Duplicate/similarity detection
 */

import { threatIntelService } from '../services/threatIntelService.js';
import { logger } from '../utils/logger.js';

export const threatIntelController = {
    async getDashboard(request, reply) {
        try {
            const result = await threatIntelService.getDashboardIntel();
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Threat intel dashboard error');
            return reply.status(500).send({ success: false, error: 'Failed to generate threat intelligence' });
        }
    },

    async getEvidenceRisk(request, reply) {
        try {
            const { id } = request.params;
            const result = await threatIntelService.calculateEvidenceRisk(id);
            if (!result) {
                return reply.status(404).send({ success: false, error: 'Evidence not found' });
            }
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Evidence risk calculation error');
            return reply.status(500).send({ success: false, error: 'Failed to calculate risk' });
        }
    },

    async getCaseThreat(request, reply) {
        try {
            const { id } = request.params;
            const result = await threatIntelService.calculateCaseThreat(id);
            if (!result) {
                return reply.status(404).send({ success: false, error: 'Case not found' });
            }
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Case threat assessment error');
            return reply.status(500).send({ success: false, error: 'Failed to assess case threat' });
        }
    },

    async getAnomalies(request, reply) {
        try {
            const result = await threatIntelService.detectAnomalies();
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Anomaly detection error');
            return reply.status(500).send({ success: false, error: 'Failed to detect anomalies' });
        }
    },

    async getDuplicates(request, reply) {
        try {
            const result = await threatIntelService.detectDuplicates();
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Duplicate detection error');
            return reply.status(500).send({ success: false, error: 'Failed to detect duplicates' });
        }
    },
};
