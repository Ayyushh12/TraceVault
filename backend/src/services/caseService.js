/**
 * Case Management Service
 */

import crypto from 'node:crypto';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import { NotFoundError } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDelete } from '../core/redis.js';
import { logger } from '../utils/logger.js';

export class CaseService {
    /**
     * Create a new case.
     */
    async createCase(data, mcpContext) {
        const caseDoc = new Case({
            case_id: crypto.randomUUID(),
            case_name: data.case_name,
            description: data.description || '',
            created_by: mcpContext.user_id,
            investigators: [mcpContext.user_id, ...(data.investigators || [])],
            classification: data.classification || 'unclassified',
            priority: data.priority || 'medium',
            case_type: data.case_type || 'investigation',
            status: data.status || 'open',
            tags: data.tags || [],
        });

        await caseDoc.save();

        // Invalidate cases cache immediately so list updates instantly
        await this._invalidateCasesCache(mcpContext.user_id);

        logger.info({ caseId: caseDoc.case_id }, 'Case created');
        return caseDoc.toObject();
    }

    /**
     * Get all cases accessible to user.
     */
    async getCases(mcpContext, page = 1, limit = 20) {
        const cacheKey = `cases:${mcpContext.user_id}:${page}:${limit}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        let query = {};

        // Non-admin users can only see cases they are part of
        if (mcpContext.role !== 'admin') {
            query = {
                $or: [
                    { created_by: mcpContext.user_id },
                    { investigators: mcpContext.user_id },
                ],
            };
        }

        const skip = (page - 1) * limit;
        const [cases, total] = await Promise.all([
            Case.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
            Case.countDocuments(query),
        ]);

        const result = {
            cases,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };

        // Short cache TTL (15s) for faster data appearance
        await cacheSet(cacheKey, result, 15);
        return result;
    }

    /**
     * Get case by ID.
     */
    async getCaseById(caseId, mcpContext) {
        const cacheKey = `case:${caseId}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const caseDoc = await Case.findOne({ case_id: caseId }).lean();
        if (!caseDoc) {
            throw new NotFoundError('Case');
        }

        // Check access
        if (mcpContext.role !== 'admin') {
            const hasAccess = caseDoc.created_by === mcpContext.user_id
                || caseDoc.investigators.includes(mcpContext.user_id);
            if (!hasAccess) {
                throw new NotFoundError('Case');
            }
        }

        // Attach evidence count from Evidence collection
        const evidenceCount = await Evidence.countDocuments({ case_id: caseId, status: 'active' });
        caseDoc.evidence_count = evidenceCount;

        await cacheSet(cacheKey, caseDoc, 60);
        return caseDoc;
    }

    /**
     * Update a case.
     */
    async updateCase(caseId, data, mcpContext) {
        const caseDoc = await Case.findOne({ case_id: caseId });
        if (!caseDoc) {
            throw new NotFoundError('Case');
        }

        // Check permissions
        if (mcpContext.role !== 'admin') {
            const hasAccess = caseDoc.created_by === mcpContext.user_id
                || caseDoc.investigators.includes(mcpContext.user_id);
            if (!hasAccess) {
                throw new NotFoundError('Case');
            }
        }

        if (data.case_name) caseDoc.case_name = data.case_name;
        if (data.description !== undefined) caseDoc.description = data.description;
        if (data.status) {
            caseDoc.status = data.status;
            if (data.status === 'closed') caseDoc.closed_at = new Date();
        }
        if (data.classification) caseDoc.classification = data.classification;
        if (data.priority) caseDoc.priority = data.priority;
        if (data.case_type) caseDoc.case_type = data.case_type;
        if (data.investigators) caseDoc.investigators = data.investigators;
        if (data.tags) caseDoc.tags = data.tags;

        await caseDoc.save();
        await cacheDelete(`case:${caseId}`);
        await this._invalidateCasesCache(mcpContext.user_id);

        logger.info({ caseId }, 'Case updated');
        return caseDoc.toObject();
    }

    /**
     * Delete/archive a case.
     */
    async deleteCase(caseId, mcpContext) {
        const caseDoc = await Case.findOne({ case_id: caseId });
        if (!caseDoc) {
            throw new NotFoundError('Case');
        }

        caseDoc.status = 'archived';
        caseDoc.closed_at = new Date();
        await caseDoc.save();

        await cacheDelete(`case:${caseId}`);
        await this._invalidateCasesCache(mcpContext.user_id);

        logger.info({ caseId }, 'Case archived');
        return { case_id: caseId, status: 'archived' };
    }

    /**
     * Add a note to a case.
     */
    async addNote(caseId, noteData, mcpContext) {
        const caseDoc = await Case.findOne({ case_id: caseId });
        if (!caseDoc) {
            throw new NotFoundError('Case');
        }

        caseDoc.notes.push({
            author_id: mcpContext.user_id,
            author_name: mcpContext.full_name || mcpContext.username || 'Unknown',
            content: noteData.content,
            created_at: new Date(),
        });

        await caseDoc.save();
        await cacheDelete(`case:${caseId}`);

        logger.info({ caseId }, 'Note added to case');
        return caseDoc.toObject();
    }

    /**
     * Increment evidence count for a case.
     */
    async incrementEvidenceCount(caseId) {
        await Case.updateOne({ case_id: caseId }, { $inc: { evidence_count: 1 } });
        await cacheDelete(`case:${caseId}`);
    }

    /**
     * Get case statistics.
     */
    async getStats(mcpContext) {
        let query = {};
        if (mcpContext.role !== 'admin') {
            query = {
                $or: [
                    { created_by: mcpContext.user_id },
                    { investigators: mcpContext.user_id },
                ],
            };
        }

        const [total, open, investigating, closed, byPriority] = await Promise.all([
            Case.countDocuments(query),
            Case.countDocuments({ ...query, status: { $in: ['open', 'active'] } }),
            Case.countDocuments({ ...query, status: 'investigating' }),
            Case.countDocuments({ ...query, status: 'closed' }),
            Case.aggregate([
                { $match: query },
                { $group: { _id: '$priority', count: { $sum: 1 } } },
            ]),
        ]);

        const priorityMap = {};
        byPriority.forEach(p => { priorityMap[p._id || 'medium'] = p.count; });

        return {
            total,
            open,
            investigating,
            closed,
            archived: total - open - investigating - closed,
            by_priority: priorityMap,
        };
    }

    /**
     * Invalidate all cases cache for a user.
     */
    async _invalidateCasesCache(userId) {
        // Clear common cache keys
        for (let p = 1; p <= 5; p++) {
            for (const l of [20, 50, 100]) {
                await cacheDelete(`cases:${userId}:${p}:${l}`);
            }
        }
    }
}

export const caseService = new CaseService();
