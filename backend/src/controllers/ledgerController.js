/**
 * Ledger Controller
 */

import { ledgerAnchorService } from '../services/ledgerAnchorService.js';
import { validate, paginationSchema } from '../validators/schemas.js';

export class LedgerController {
    async getLatestAnchor(request, reply) {
        const result = await ledgerAnchorService.getLatestAnchor();
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getAnchors(request, reply) {
        const { page, limit } = validate(paginationSchema, request.query);
        const result = await ledgerAnchorService.getAnchors(page, limit);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getAnchorByDate(request, reply) {
        const result = await ledgerAnchorService.getAnchorByDate(request.params.date);
        if (!result) {
            return reply.status(404).send({
                success: false,
                error: 'No anchor found for the specified date',
            });
        }
        return reply.send({
            success: true,
            data: result,
        });
    }

    async verifyAnchorChain(request, reply) {
        const result = await ledgerAnchorService.verifyAnchorChain();
        return reply.send({
            success: true,
            data: result,
        });
    }
}

export const ledgerController = new LedgerController();
