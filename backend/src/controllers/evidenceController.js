/**
 * Evidence Controller
 */

import { evidenceService } from '../services/evidenceService.js';
import { custodyService } from '../services/custodyService.js';
import { validate, uploadEvidenceSchema, updateEvidenceSchema, paginationSchema } from '../validators/schemas.js';

export class EvidenceController {
    async upload(request, reply) {
        // We will collect multiple files and their associated metadata fields.
        const files = [];
        const metadataFields = {};

        for await (const part of request.parts()) {
            if (part.file) {
                // Collect file buffer
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                
                files.push({
                    buffer,
                    filename: part.filename,
                    mimetype: part.mimetype,
                    fieldName: part.fieldname, // Usually 'files' or specific indices
                });
            } else {
                // Collect string fields (case_id, description, tags, etc.)
                let value = part.value;
                if (part.fieldname === 'tags' && typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        value = [];
                    }
                }
                metadataFields[part.fieldname] = value;
            }
        }

        if (files.length === 0) {
            return reply.status(400).send({
                success: false,
                error: 'No files provided',
            });
        }

        const case_id = metadataFields.case_id || '';
        if (!case_id) {
            return reply.status(400).send({ success: false, error: 'case_id is required' });
        }

        const results = [];
        
        // Process each file
        for (const file of files) {
            // Validate metadata for each upload iteration
            const fileMetadata = {
                case_id: case_id,
                description: metadataFields.description || '',
                tags: Array.isArray(metadataFields.tags) ? metadataFields.tags : [],
                name: metadataFields.name || file.filename, 
                category: metadataFields.category || 'other',
            };

            const validatedMeta = validate(uploadEvidenceSchema, fileMetadata);

            const result = await evidenceService.uploadEvidence(
                {
                    buffer: file.buffer,
                    filename: file.filename,
                    mimetype: file.mimetype,
                },
                validatedMeta,
                (request.mcpContext || request.user)
            );
            results.push(result);
        }

        return reply.status(201).send({
            success: true,
            message: 'Evidence uploaded successfully',
            data: results,
        });
    }

    async list(request, reply) {
        const { page, limit } = validate(paginationSchema, request.query);
        const caseId = request.query.case_id || null;
        const result = await evidenceService.listEvidence((request.mcpContext || request.user), caseId, page, limit);
        return reply.send({
            success: true,
            data: result,
        });
    }

    async getById(request, reply) {
        const result = await evidenceService.getEvidenceById(request.params.id, (request.mcpContext || request.user));
        return reply.send({
            success: true,
            data: result,
        });
    }

    async download(request, reply) {
        const result = await evidenceService.downloadEvidence(request.params.id, (request.mcpContext || request.user));

        return reply
            .header('Content-Type', result.mimetype)
            .header('Content-Disposition', `attachment; filename="${result.filename}"`)
            .header('X-Evidence-Hash', result.fileHash)
            .send(result.buffer);
    }

    async sign(request, reply) {
        const { private_key } = request.body;

        if (!private_key) {
            return reply.status(400).send({
                success: false,
                error: 'Private key is required for signing',
            });
        }

        const result = await evidenceService.signEvidence(
            request.params.id,
            private_key,
            (request.mcpContext || request.user)
        );

        return reply.send({
            success: true,
            message: 'Evidence signed successfully',
            data: result,
        });
    }

    async lock(request, reply) {
        const { durationHours, reason } = request.body || {};
        const hours = parseInt(durationHours) || 24;
        
        try {
            const result = await evidenceService.lockEvidence(
                request.params.id,
                hours,
                reason,
                (request.mcpContext || request.user)
            );

            return reply.send({
                success: true,
                message: `Evidence locked for ${hours} hours successfully`,
                data: result,
            });
        } catch (err) {
            return reply.status(400).send({ success: false, error: err.message });
        }
    }

    async unlock(request, reply) {
        const { reason } = request.body || {};
        try {
            const result = await evidenceService.unlockEvidence(
                request.params.id,
                reason,
                (request.mcpContext || request.user)
            );

            return reply.send({
                success: true,
                message: 'Evidence unlocked successfully. Asset is now re-readable.',
                data: result,
            });
        } catch (err) {
            return reply.status(400).send({ success: false, error: err.message });
        }
    }

    async transfer(request, reply) {
        const { to_user_id, reason } = request.body || {};
        if (!to_user_id) {
            return reply.status(400).send({ success: false, error: 'to_user_id is required' });
        }

        try {
            const result = await custodyService.transferCustody(
                request.params.id,
                to_user_id,
                reason,
                (request.mcpContext || request.user)
            );

            return reply.send({
                success: true,
                message: 'Custody transferred successfully',
                data: result,
            });
        } catch (err) {
            return reply.status(400).send({ success: false, error: err.message });
        }
    }

    async update(request, reply) {
        const validatedMeta = validate(updateEvidenceSchema, request.body);
        const result = await evidenceService.updateEvidenceMetadata(request.params.id, validatedMeta, (request.mcpContext || request.user));
        
        return reply.send({
            success: true,
            message: 'Evidence metadata updated successfully',
            data: result,
        });
    }

    async preview(request, reply) {
        // Preview uses the same download logic but sends inline content disposition
        const result = await evidenceService.downloadEvidence(request.params.id, (request.mcpContext || request.user));

        return reply
            .header('Content-Type', result.mimetype)
            .header('Content-Disposition', `inline; filename="${result.filename}"`)
            .header('X-Evidence-Hash', result.fileHash)
            .send(result.buffer);
    }

    async getVersions(request, reply) {
        const versions = await evidenceService.getEvidenceVersions(request.params.id);
        return reply.send({ success: true, data: { versions, total: versions.length } });
    }

    async bulkAction(request, reply) {
        const { action, evidence_ids, reason } = request.body || {};
        if (!action || !Array.isArray(evidence_ids) || evidence_ids.length === 0) {
            return reply.status(400).send({ success: false, error: 'action and evidence_ids[] are required' });
        }
        const results = await evidenceService.bulkAction(action, evidence_ids, reason, (request.mcpContext || request.user));
        return reply.send({
            success: true,
            message: `Bulk ${action} completed for ${results.processed} items`,
            data: results,
        });
    }
}

export const evidenceController = new EvidenceController();
