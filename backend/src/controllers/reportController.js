/**
 * Report Controller
 */

import { reportService } from '../services/reportService.js';

export class ReportController {
    async generateEvidenceReport(request, reply) {
        const format = request.query.format || 'json';
        const result = await reportService.generateEvidenceReport(
            request.params.id,
            format,
            request.mcpContext
        );

        if (format === 'pdf') {
            return reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="forensic_report_${request.params.id}.pdf"`)
                .send(result);
        }

        return reply.send({
            success: true,
            data: result,
        });
    }

    async generateCaseReport(request, reply) {
        const format = request.query.format || 'json';
        const result = await reportService.generateCaseReport(
            request.params.id,
            format,
            request.mcpContext
        );

        if (format === 'pdf') {
            return reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="case_summary_${request.params.id}.pdf"`)
                .send(result);
        }

        return reply.send({ success: true, data: result });
    }

    async generateAuditReport(request, reply) {
        const format = request.query.format || 'json';
        const result = await reportService.generateAuditReport(
            format,
            request.mcpContext
        );

        if (format === 'pdf') {
            return reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="audit_trail_${new Date().getTime()}.pdf"`)
                .send(result);
        }

        return reply.send({ success: true, data: result });
    }
}

export const reportController = new ReportController();
