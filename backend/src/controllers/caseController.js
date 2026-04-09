/**
 * Case Controller
 */

import { caseService } from '../services/caseService.js';
import { exportService } from '../services/exportService.js';
import { validate, createCaseSchema, updateCaseSchema, paginationSchema } from '../validators/schemas.js';

export class CaseController {
    async createCase(request, reply) {
        const data = validate(createCaseSchema, request.body);
        const result = await caseService.createCase(data, request.mcpContext);
        return reply.status(201).send({
            success: true,
            message: 'Case created successfully',
            data: result,
        });
    }

    async getCases(request, reply) {
        const { page, limit } = validate(paginationSchema, request.query);
        const result = await caseService.getCases(request.mcpContext, page, limit);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getCaseById(request, reply) {
        const result = await caseService.getCaseById(request.params.id, request.mcpContext);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async updateCase(request, reply) {
        const data = validate(updateCaseSchema, request.body);
        const result = await caseService.updateCase(request.params.id, data, request.mcpContext);
        return reply.send({
            success: true,
            message: 'Case updated successfully',
            data: result,
        });
    }

    async deleteCase(request, reply) {
        const result = await caseService.deleteCase(request.params.id, request.mcpContext);
        return reply.send({
            success: true,
            message: 'Case archived successfully',
            data: result,
        });
    }

    async addNote(request, reply) {
        const { content } = request.body;
        if (!content || !content.trim()) {
            return reply.status(400).send({ success: false, error: 'Note content is required' });
        }
        const result = await caseService.addNote(request.params.id, { content: content.trim() }, request.mcpContext);
        return reply.send({
            success: true,
            message: 'Note added successfully',
            data: result,
        });
    }

    async getStats(request, reply) {
        const result = await caseService.getStats(request.mcpContext);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async generateReport(request, reply) {
        return exportService.generateReport(request.params.id, request.mcpContext, reply);
    }

    async generateExport(request, reply) {
        return exportService.generateExport(request.params.id, request.mcpContext, reply);
    }
}

export const caseController = new CaseController();
