/**
 * Custody Controller
 */

import { custodyService } from '../services/custodyService.js';
import { timelineService } from '../services/timelineService.js';
import { validate, transferCustodySchema } from '../validators/schemas.js';

export class CustodyController {
    async transfer(request, reply) {
        const data = validate(transferCustodySchema, request.body);
        const result = await custodyService.transferCustody(
            data.evidence_id,
            data.new_custodian_id,
            data.reason,
            request.mcpContext
        );
        return reply.send({
            success: true,
            message: 'Custody transferred successfully',
            data: result,
        });
    }

    async getTimeline(request, reply) {
        const result = await timelineService.getTimeline(request.params.id);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getCustodyChain(request, reply) {
        // Pass query object directly to match filter signature
        const result = await custodyService.getCustodyChain(request.params.id, request.query);
        return reply.send({
            success: true,
            data: {
                evidence_id: request.params.id,
                chain_length: result.length,
                events: result,
            },
        });
    }

    async verifyChain(request, reply) {
        const result = await custodyService.verifyCustodyChain(request.params.id);
        return reply.send({
            success: true,
            data: result,
        });
    }
}

export const custodyController = new CustodyController();
