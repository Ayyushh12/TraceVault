/**
 * Dashboard Controller
 * 
 * Provides aggregated statistics for the dashboard.
 */

import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
import AuditLog from '../models/AuditLog.js';
import CustodyEvent from '../models/CustodyEvent.js';
import User from '../models/User.js';
import { cacheGet, cacheSet } from '../core/redis.js';

export class DashboardController {
    async getStats(request, reply) {
        const { user_id, role } = request.mcpContext;
        const cacheKey = `dashboard:stats:${user_id}`;
        
        // Very short cache (10s) for near-real-time feel
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return reply.send({ success: true, data: cached });
        }

        let caseQuery = {};
        let evidenceQuery = {};

        if (role !== 'admin') {
            caseQuery = {
                $or: [
                    { created_by: user_id },
                    { investigators: user_id },
                ],
            };
        }

        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalEvidence,
            verifiedEvidence,
            tamperedEvidence,
            pendingEvidence,
            totalCases,
            openCases,
            closedCases,
            investigatingCases,
            todayAuditLogs,
            totalAuditLogs,
            todayUploads,
            weeklyUploads,
            totalUsers,
            recentActivity,
            evidenceByCategory,
            casesByPriority,
        ] = await Promise.all([
            Evidence.countDocuments({ status: 'active' }),
            Evidence.countDocuments({ status: 'active', integrity_status: 'verified' }).catch(() => 0),
            Evidence.countDocuments({ status: 'active', integrity_status: 'tampered' }).catch(() => 0),
            Evidence.countDocuments({ status: 'active', integrity_status: { $in: ['pending', 'unverified'] } }),
            Case.countDocuments(caseQuery),
            Case.countDocuments({ ...caseQuery, status: { $in: ['open', 'active'] } }),
            Case.countDocuments({ ...caseQuery, status: 'closed' }),
            Case.countDocuments({ ...caseQuery, status: { $in: ['investigating', 'in_progress'] } }),
            AuditLog.countDocuments({ timestamp: { $gte: today }, archived: false }),
            AuditLog.countDocuments({ archived: false }),
            Evidence.countDocuments({ created_at: { $gte: today } }),
            Evidence.countDocuments({ created_at: { $gte: weekAgo } }),
            User.countDocuments({ is_active: true }),
            AuditLog.find({ archived: false }).sort({ timestamp: -1 }).limit(15).lean(),
            Evidence.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]).catch(() => []),
            Case.aggregate([
                { $match: caseQuery },
                { $group: { _id: '$priority', count: { $sum: 1 } } },
            ]).catch(() => []),
        ]);

        const stats = {
            evidence: {
                total: totalEvidence,
                verified: verifiedEvidence,
                tampered: tamperedEvidence,
                pending: pendingEvidence,
                today_uploads: todayUploads,
                weekly_uploads: weeklyUploads,
                by_category: evidenceByCategory.reduce((acc, c) => { acc[c._id || 'other'] = c.count; return acc; }, {}),
            },
            cases: {
                total: totalCases,
                open: openCases,
                closed: closedCases,
                investigating: investigatingCases,
                by_priority: casesByPriority.reduce((acc, c) => { acc[c._id || 'medium'] = c.count; return acc; }, {}),
            },
            audit: {
                total: totalAuditLogs,
                today: todayAuditLogs,
            },
            users: {
                total: totalUsers,
            },
            recent_activity: recentActivity,
        };

        await cacheSet(cacheKey, stats, 10);

        return reply.send({
            success: true,
            data: stats,
        });
    }

    /**
     * Search across evidence, cases, and users.
     */
    async search(request, reply) {
        const { q, type, page, limit } = request.query;
        
        if (!q || q.trim().length < 1) {
            return reply.status(400).send({ success: false, error: 'Search query is required' });
        }

        const searchTerm = q.trim();
        const regex = new RegExp(searchTerm, 'i');
        const skip = ((page || 1) - 1) * (limit || 10);
        const lim = Math.min(limit || 10, 50);

        const results = { evidence: [], cases: [], users: [] };

        if (type === 'all' || type === 'evidence') {
            results.evidence = await Evidence.find({
                status: 'active',
                $or: [
                    { original_name: regex },
                    { description: regex },
                    { evidence_id: regex },
                    { file_hash: regex },
                    { tags: regex },
                ],
            }).sort({ created_at: -1 }).skip(skip).limit(lim).lean().catch(() => []);
        }

        if (type === 'all' || type === 'cases') {
            results.cases = await Case.find({
                $or: [
                    { case_name: regex },
                    { description: regex },
                    { case_id: regex },
                    { tags: regex },
                ],
            }).sort({ created_at: -1 }).skip(skip).limit(lim).lean().catch(() => []);
        }

        if ((type === 'all' || type === 'users') && request.mcpContext.role === 'admin') {
            results.users = await User.find({
                $or: [
                    { username: regex },
                    { full_name: regex },
                    { email: regex },
                ],
            }).select('-password_hash -totp_secret').skip(skip).limit(lim).lean().catch(() => []);
        }

        return reply.send({
            success: true,
            data: results,
            query: searchTerm,
        });
    }
}

export const dashboardController = new DashboardController();
