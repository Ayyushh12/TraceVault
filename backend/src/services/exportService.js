import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import crypto from 'node:crypto';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import CustodyEvent from '../models/CustodyEvent.js';
import { NotFoundError } from '../utils/errors.js';
import { getStorageDriver } from '../forensics/storageEngine.js';
import { evidenceService } from './evidenceService.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs';

class ExportService {
    /**
     * Generate a Forensic Integrity Report (PDF)
     */
    async generateReport(caseId, mcpContext, reply) {
        const caseDoc = await Case.findOne({ case_id: caseId }).lean();
        if (!caseDoc) throw new NotFoundError('Case');

        const evidences = await Evidence.find({ case_id: caseId, status: { $ne: 'deleted' } }).lean();

        // Create PDF Document
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Case_Inventory_Report_${caseId}.pdf"`);
        doc.pipe(reply.raw);

        const BRAND_COLOR = '#059669'; // Emerald 600
        const TEXT_COLOR = '#111827';
        const MUTED_TEXT = '#6b7280';
        const BORDER_COLOR = '#e2e8f0';

        // ─── Header ────────────────────────────────────────────────────
        doc.rect(0, 0, 600, 100).fill(BRAND_COLOR);
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
            .text('TRACEVAULT', 50, 35);
        doc.fontSize(10).font('Helvetica')
            .text('CASE INVENTORY & INTEGRITY AUDIT', 50, 60, { characterSpacing: 1 });
        
        doc.fontSize(8).text('OFFICIAL RECORD', 450, 35, { align: 'right', width: 100 });
        doc.text(`CASE ID: ${caseId.toUpperCase()}`, 350, 50, { align: 'right', width: 200 });
        doc.text(`DATE: ${new Date().toUTCString()}`, 350, 62, { align: 'right', width: 200 });

        doc.y = 120;

        // ─── Case Summary ──────────────────────────────────────────────
        doc.fillColor(BRAND_COLOR).fontSize(12).font('Helvetica-Bold').text('CASE DOSSIER SUMMARY');
        doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).lineWidth(0.5).stroke(BORDER_COLOR);
        doc.moveDown();

        doc.fillColor(TEXT_COLOR).fontSize(10);
        doc.font('Helvetica-Bold').text('Title:', 50, doc.y, { continued: true }).font('Helvetica').text(`  ${caseDoc.case_name}`);
        doc.font('Helvetica-Bold').text('Status:', 50, doc.y, { continued: true }).font('Helvetica').text(`  ${caseDoc.status.toUpperCase()}`);
        doc.font('Helvetica-Bold').text('Classification:', 50, doc.y, { continued: true }).font('Helvetica').text(`  ${(caseDoc.classification || 'UNCLASSIFIED').toUpperCase()}`);
        doc.font('Helvetica-Bold').text('Lead Officer:', 50, doc.y, { continued: true }).font('Helvetica').text(`  ${caseDoc.created_by_name || 'System'}`);
        
        doc.moveDown(2);

        // ─── Evidence Inventory ────────────────────────────────────────
        doc.fillColor(BRAND_COLOR).fontSize(12).font('Helvetica-Bold').text(`EVIDENCE INVENTORY (${evidences.length} ITEMS)`);
        doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).lineWidth(0.5).stroke(BORDER_COLOR);
        doc.moveDown();

        if (evidences.length === 0) {
            doc.fillColor(MUTED_TEXT).fontSize(10).text('No active evidence items found in this case.', { italic: true });
        }

        for (const ev of evidences) {
            // Check for page break
            if (doc.y > 700) doc.addPage();

            doc.rect(50, doc.y, 495, 85).stroke(BORDER_COLOR);
            const startY = doc.y;

            doc.fillColor(TEXT_COLOR).fontSize(10).font('Helvetica-Bold').text(ev.original_name || ev.file_name, 60, startY + 10);
            doc.fontSize(8).fillColor(MUTED_TEXT).font('Helvetica');
            doc.text(`EVIDENCE ID: ${ev.evidence_id}`, 60, startY + 24);
            doc.text(`MIME TYPE:  ${ev.mime_type}`, 60, startY + 34);
            doc.text(`SIZE:       ${(ev.file_size / 1024 / 1024).toFixed(2)} MB`, 60, startY + 44);
            
            doc.fillColor(TEXT_COLOR).font('Helvetica-Bold').text('SECURE HASH (SHA-256):', 60, startY + 58);
            doc.font('Courier').text(ev.file_hash, 60, startY + 68);

            const statusColor = ev.integrity_status === 'verified' ? '#059669' : '#b91c1c';
            doc.fillColor(statusColor).font('Helvetica-Bold').text((ev.integrity_status || 'VERIFIED').toUpperCase(), 450, startY + 10, { width: 85, align: 'right' });

            doc.y = startY + 95;
        }

        doc.moveDown(2);
        doc.fontSize(8).fillColor(MUTED_TEXT).text('--- END OF CASE INVENTORY REPORT ---', { align: 'center' });
        doc.text(`TraceVault Security Engine v2.0.0 | Ledger Reference: ${crypto.randomBytes(4).toString('hex').toUpperCase()}`, { align: 'center' });
        
        doc.end();
        return reply;
    }

    /**
     * Generate an Offline Export Package (ZIP)
     */
    async generateExport(caseId, mcpContext, reply) {
        const caseDoc = await Case.findOne({ case_id: caseId }).lean();
        if (!caseDoc) throw new NotFoundError('Case');

        const evidences = await Evidence.find({ case_id: caseId, status: { $ne: 'deleted' } }).lean();

        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="Export_${caseId}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(reply.raw);

        // Add pure JSON metadata of Case & Evidence
        archive.append(JSON.stringify(caseDoc, null, 2), { name: 'case_metadata.json' });
        archive.append(JSON.stringify(evidences, null, 2), { name: 'evidence_metadata.json' });

        const storage = getStorageDriver();

        // Add each decrypted evidence file
        for (const ev of evidences) {
            try {
                // Download file locally into a buffer and append to zip
                // Using internal `evidenceService` download to auto-decrypt
                const decryptedData = await evidenceService.downloadEvidence(ev.evidence_id, mcpContext);
                archive.append(decryptedData.buffer, { name: `evidence/${ev.original_name}` });
            } catch (err) {
                logger.error({ evidence_id: ev.evidence_id, err }, 'Failed to export evidence in ZIP package');
                archive.append(`ERROR: Failed to export this file (${err.message})`, { name: `evidence/${ev.original_name}_ERROR.txt` });
            }
        }

        await archive.finalize();
        return reply;
    }
}

export const exportService = new ExportService();
