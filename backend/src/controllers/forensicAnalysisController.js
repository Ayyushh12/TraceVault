/**
 * Forensic Analysis Controller
 */

import { forensicAnalysisService } from '../services/forensicAnalysisService.js';
import { logger } from '../utils/logger.js';

export const forensicAnalysisController = {
    async analyzeEvidence(request, reply) {
        try {
            const { id } = request.params;
            const context = request.mcpContext || { user_id: request.user?.user_id || 'system' };
            const result = await forensicAnalysisService.analyzeEvidenceFile(id, context);
            return reply.send({ success: true, data: result });
        } catch (err) {
            logger.error({ err, id: request.params.id }, 'Deep forensic analysis failed');
            return reply.status(500).send({ success: false, error: 'Failed to complete deep forensic analysis' });
        }
    }
};
