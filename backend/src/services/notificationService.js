import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';

/**
 * Event Triggers -> Rule Engine -> Priority -> Queue -> Delivery -> UI
 */

const SEVERITY_BASE_SCORE = {
    'CRITICAL': 80,
    'WARNING': 50,
    'INFO': 10,
    'SYSTEM': 5
};

// Global WS clients simple manager so we don't have circular dependencies
export const connectedClients = new Map(); // userId -> Set(WebSocket)

/**
 * Send a generic event via WebSocket to a specific user
 */
function sendRealtimeUpdate(userId, eventType, payload) {
    const clients = connectedClients.get(userId.toString());
    if (clients) {
        for (const ws of clients) {
            try {
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(JSON.stringify({ type: eventType, payload }));
                }
            } catch (err) {
                logger.error({ err }, 'WS delivery failed');
            }
        }
    }
}

class NotificationService {
    
    /**
     * Rules to classify notification Severity and Type based on EventType
     */
    classifyEvent(eventType) {
        const rules = {
            'HASH_MISMATCH': { type: 'SECURITY', severity: 'CRITICAL' },
            'UNAUTHORIZED_ACCESS': { type: 'SECURITY', severity: 'CRITICAL' },
            'MASS_DOWNLOAD': { type: 'SECURITY', severity: 'WARNING' },
            'OFF_HOURS_ACCESS': { type: 'SECURITY', severity: 'WARNING' },
            'RAPID_CUSTODY': { type: 'CUSTODY', severity: 'WARNING' },
            'NEW_DEVICE_LOGIN': { type: 'SECURITY', severity: 'INFO' },
            'ADMIN_ACTION': { type: 'ADMIN', severity: 'INFO' },
            'SYSTEM_ERROR': { type: 'SYSTEM', severity: 'CRITICAL' },
            'JOB_FAILED': { type: 'SYSTEM', severity: 'WARNING' },
            'EVIDENCE_UPLOADED': { type: 'EVIDENCE', severity: 'INFO' },
            'CUSTODY_TRANSFERRED': { type: 'CUSTODY', severity: 'INFO' },
            'ANALYSIS_COMPLETE': { type: 'EVIDENCE', severity: 'INFO' }
        };

        return rules[eventType] || { type: 'SYSTEM', severity: 'INFO' };
    }

    /**
     * Calculate Priority Score = severity + frequency_in_last_day + user_risk_factor
     */
    async calculatePriority(userId, severity, eventType) {
        let score = SEVERITY_BASE_SCORE[severity] || 0;

        // Add frequency
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const freqCount = await Notification.countDocuments({
            user_id: userId,
            event_type: eventType,
            created_at: { $gt: oneDayAgo }
        });
        
        // +5 points for every time this happened in the last 24h (cap at 20)
        score += Math.min(freqCount * 5, 20);

        // Fetch User role risk - Admins failing stuff is worse, regular users doing weird things is worse
        // Faking complex user risk for now.
        if (severity === 'CRITICAL') {
             score += 10; 
        }

        return Math.min(score, 100);
    }

    /**
     * Main entry point to Trigger a Notification
     */
    async createNotification(userId, eventType, title, description, metadata = {}, actionUrl = null) {
        try {
            const { type, severity } = this.classifyEvent(eventType);

            // Deduplication Check (within last 30 seconds)
            const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
            const recentDuplicate = await Notification.findOne({
                user_id: userId,
                event_type: eventType,
                title: title, // Same exact title
                created_at: { $gt: thirtySecondsAgo },
                read: false
            });

            if (recentDuplicate) {
                // Group it!
                recentDuplicate.group_count += 1;
                recentDuplicate.updated_at = new Date();
                await recentDuplicate.save();
                
                // Real-time ping
                sendRealtimeUpdate(userId, 'NOTIFICATION_UPDATED', recentDuplicate);
                return recentDuplicate;
            }

            // Calculate exact priority
            const priorityScore = await this.calculatePriority(userId, severity, eventType);

            const notif = new Notification({
                user_id: userId,
                type,
                severity,
                title,
                description,
                event_type: eventType,
                metadata,
                action_url: actionUrl,
                priority_score: priorityScore
            });

            await notif.save();

            // Fire real-time WebSocket update
            // Also if CRITICAL, you would fire email/webhook integrations here.
            sendRealtimeUpdate(userId, 'NEW_NOTIFICATION', notif);

            return notif;

        } catch (error) {
            logger.error({ err: error, eventType, userId }, 'Failed to create notification');
        }
    }

    /**
     * Background job to escalate unread critical notifications after 5 minutes
     */
    async escalateUnreadCritical() {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const unreadCriticals = await Notification.find({
                severity: 'CRITICAL',
                read: false,
                is_escalated: false,
                created_at: { $lt: fiveMinutesAgo }
            }).limit(50); // Process in batches

            for (const notif of unreadCriticals) {
                notif.is_escalated = true;
                notif.priority_score = Math.min(notif.priority_score + 20, 100); 
                await notif.save();
                
                // Alert the system admins? 
                const admins = await User.find({ role: 'Admin', is_active: true }).select('_id');
                for (const admin of admins) {
                    if (admin._id.toString() !== notif.user_id.toString()) {
                        await this.createNotification(
                            admin._id,
                            'SYSTEM_ERROR',
                            `Escalation: Unresolved Critical Alert`,
                            `Alert '${notif.title}' for user has remained unresolved for 5 minutes.`,
                            { original_notif_id: notif._id },
                            notif.action_url
                        );
                    }
                }
            }

        } catch (error) {
            logger.error({ err: error }, 'Escalation job failed');
        }
    }

    async getNotificationsForUser(userId, query = {}) {
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        let filter = { user_id: userId };
        if (query.unreadOnly) filter.read = false;
        if (query.severity) filter.severity = query.severity;
        if (query.type) filter.type = query.type;

        // Sort by priority first (highest first), then by date
        const notifications = await Notification.find(filter)
            .sort({ priority_score: -1, created_at: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({ user_id: userId, read: false });

        return {
            notifications,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            unread_count: unreadCount
        };
    }

    async markAsRead(userId, notificationId) {
        if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;
        
        const notif = await Notification.findOneAndUpdate(
            { _id: notificationId, user_id: userId },
            { read: true, read_at: new Date() },
            { new: true }
        );
        return notif;
    }

    async markAllAsRead(userId) {
        await Notification.updateMany(
            { user_id: userId, read: false },
            { read: true, read_at: new Date() }
        );
        return { success: true };
    }

    async dismiss(userId, notificationId) {
        if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;
        
        // Soft delete or hard delete depending on your audit requirements. Let's hard delete for UI simplicity.
        await Notification.findOneAndDelete({ _id: notificationId, user_id: userId });
        return { success: true };
    }
}

export const notificationService = new NotificationService();
