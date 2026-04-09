/**
 * Verification Controller
 */

import { notificationService } from '../services/notificationService.js';
import { verificationService } from '../services/verificationService.js';
import { chainValidationService } from '../services/chainValidationService.js';

export class VerificationController {
    async verifyEvidence(request, reply) {
        const result = await verificationService.verifyEvidence(
            request.params.id,
            (request.mcpContext || request.user)
        );

        if (result.overall_result !== 'pass') {
            await notificationService.createNotification(
                request.mcpContext?.user_id || request.user?.id || 'system',
                'HASH_MISMATCH',
                'Integrity Check Failed',
                `Evidence ${request.params.id} failed verification check. Tampering detected!`,
                { evidence_id: request.params.id },
                `/evidence/${request.params.id}`
            );
        }

        return reply.send({
            success: true,
            data: result,
        });
    }

    async validateChain(request, reply) {
        const result = await chainValidationService.validateChain(request.params.id);

        if (!result.chain_valid || result.tampering_detected) {
            await notificationService.createNotification(
                request.mcpContext?.user_id || request.user?.id,
                'HASH_MISMATCH',
                'Chain Validation Failed',
                `Custody chain for evidence ${request.params.id} is broken.`,
                { evidence_id: request.params.id },
                `/evidence/${request.params.id}`
            );
        }

        return reply.send({
            success: true,
            data: result,
        });
    }
}

export const verificationController = new VerificationController();
