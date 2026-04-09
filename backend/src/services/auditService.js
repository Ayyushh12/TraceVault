/**
 * Audit Service
 *
 * Query and manage immutable audit logs.
 */

import AuditLog from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

export class AuditService {
    /**
     * Query audit logs with filtering and pagination.
     */
    async getLogs(filters = {}, page = 1, limit = 50) {
        const query = { archived: false };

        if (filters.user_id) query.user_id = filters.user_id;
        if (filters.endpoint) query.endpoint = { $regex: filters.endpoint, $options: 'i' };
        if (filters.start_date || filters.end_date) {
            query.timestamp = {};
            if (filters.start_date) query.timestamp.$gte = new Date(filters.start_date);
            if (filters.end_date) query.timestamp.$lte = new Date(filters.end_date);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
            AuditLog.countDocuments(query),
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get audit log by request ID.
     */
    async getByRequestId(requestId) {
        return AuditLog.findOne({ request_id: requestId }).lean();
    }

    /**
     * Archive old audit logs (mark as archived, don't delete).
     * @param {number} olderThanDays
     * @returns {Promise<number>} count of archived logs
     */
    async archiveLogs(olderThanDays = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        const result = await AuditLog.updateMany(
            { timestamp: { $lt: cutoff }, archived: false },
            { $set: { archived: true } }
        );

        logger.info({ archived: result.modifiedCount, olderThan: cutoff.toISOString() }, 'Audit logs archived');
        return result.modifiedCount;
    }

    /**
     * Get audit statistics.
     */
    async getStats() {
        const [total, archived, todayCount] = await Promise.all([
            AuditLog.countDocuments({}),
            AuditLog.countDocuments({ archived: true }),
            AuditLog.countDocuments({
                timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
        ]);

        return {
            total_logs: total,
            archived_logs: archived,
            active_logs: total - archived,
            today_logs: todayCount,
        };
    }

    /**
     * Get Deep Native Activity Analytics
     * This entirely replaces the frontend client-side sorting loop 
     * by using raw MongoDB map-reduce efficiency.
     */
    async getActivityAnalytics(days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const matchStage = { $match: { timestamp: { $gte: cutoff }, archived: false } };

        const [usersRaw, actionsRaw, hoursRaw, daysRaw] = await Promise.all([
            // 1. Top Users Ranking
            AuditLog.aggregate([
                matchStage,
                { $group: { _id: '$user_id', count: { $sum: 1 }, actor_name: { $first: '$actor_name' } } },
                { $sort: { count: -1 } },
                { $limit: 8 }
            ]),
            // 2. Top Actions
            AuditLog.aggregate([
                matchStage,
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 6 }
            ]),
            // 3. Hourly Heatmap Pattern
            AuditLog.aggregate([
                matchStage,
                { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } }
            ]),
            // 4. Daily Heatmap (Grid)
            AuditLog.aggregate([
                matchStage,
                { $group: { 
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    count: { $sum: 1 }
                }}
            ])
        ]);

        // Process data to perfectly match the UI exact structure
        const topUsers = usersRaw.map(u => [u._id, { name: u.actor_name || 'System', count: u.count }]);
        const topActions = actionsRaw.map(a => [a._id || 'unknown', a.count]);

        const hourMap = Array(24).fill(0);
        let maxHour = 1;
        hoursRaw.forEach(h => {
            if (h._id >= 0 && h._id <= 23) {
                hourMap[h._id] = h.count;
                if (h.count > maxHour) maxHour = h.count;
            }
        });
        const peakHour = hourMap.indexOf(Math.max(...hourMap));

        const dayCounts = {};
        let calMax = 1;
        daysRaw.forEach(d => {
            dayCounts[d._id] = d.count;
            if (d.count > calMax) calMax = d.count;
        });

        return {
            topUsers,
            topActions,
            hourMap,
            maxHour,
            peakHour,
            dayCounts,
            calMax
        };
    }
}

export const auditService = new AuditService();
