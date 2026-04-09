/**
 * Audit Controller
 */

import { auditService } from '../services/auditService.js';
import { validate, auditQuerySchema } from '../validators/schemas.js';

export class AuditController {
    async getLogs(request, reply) {
        const params = validate(auditQuerySchema, request.query);
        const result = await auditService.getLogs(
            {
                user_id: params.user_id,
                endpoint: params.endpoint,
                start_date: params.start_date,
                end_date: params.end_date,
            },
            params.page,
            params.limit
        );
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getStats(request, reply) {
        const result = await auditService.getStats();
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getAnalytics(request, reply) {
        const days = request.query.days ? parseInt(request.query.days, 10) : 30;
        const result = await auditService.getActivityAnalytics(days);
        return reply.send({
            success: true,
            data: result,
        });
    }
}

export const auditController = new AuditController();
