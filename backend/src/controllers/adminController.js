/**
 * Admin Controller – Super User Management
 *
 * Full admin capabilities modeled after law enforcement governance tools:
 *   - CJIS (Criminal Justice Information Services)
 *   - NCIC (National Crime Information Center)
 *   - Interpol I-24/7 Access Control Model
 *
 * Admin privileges:
 *   1. User Management (CRUD, approve, reject, activate, deactivate)
 *   2. Role Assignment (promote/demote with audit trail)
 *   3. Permission Management (grant/revoke granular permissions)
 *   4. Security Dashboard (login attempts, threat overview)
 *   5. System Configuration (runtime settings)
 *   6. Force Password Reset
 *   7. Session Management (force logout, view active sessions)
 *   8. Audit Log Management (export, archive)
 *   9. Evidence Governance (seal, unseal, mark classified)
 *  10. Email Alert Configuration
 */

import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
import { validate } from '../validators/schemas.js';
import { z } from 'zod';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { sendSecurityAlert, sendNotificationEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { cacheGet, cacheSet, cacheDelete } from '../core/redis.js';
import { runIntegrityVerificationJob } from '../jobs/integrityVerificationJob.js';

// ─── Validation Schemas ──────────────────────────────────────

const updateUserRoleSchema = z.object({
    role: z.enum(['admin', 'investigator', 'auditor', 'viewer']),
    reason: z.string().min(5).max(500).optional(),
});

const updateUserStatusSchema = z.object({
    is_active: z.boolean(),
    reason: z.string().min(5).max(500).optional(),
});

const createUserSchema = z.object({
    username: z.string().min(3).max(50).trim(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(8).max(128),
    full_name: z.string().min(2).max(100).trim(),
    role: z.enum(['admin', 'investigator', 'auditor', 'viewer']).default('investigator'),
    department: z.string().max(100).trim().optional(),
    badge_number: z.string().max(50).trim().optional(),
});

const bulkActionSchema = z.object({
    user_ids: z.array(z.string()).min(1).max(50),
    action: z.enum(['activate', 'deactivate', 'force_password_reset']),
    reason: z.string().min(5).max(500).optional(),
});

// ─── Admin Controller ────────────────────────────────────────

export class AdminController {

    // ┌─────────────────────────────────────────────┐
    // │ 1. LIST ALL USERS (with filters & search)   │
    // └─────────────────────────────────────────────┘
    async listUsers(request, reply) {
        const { page = 1, limit = 20, role, status, search, sort = '-created_at' } = request.query;

        const filter = {};
        if (role) filter.role = role;
        if (status === 'active') filter.is_active = true;
        if (status === 'inactive') filter.is_active = false;
        if (search) {
            filter.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password_hash -public_key')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(filter),
        ]);

        // Enrich with online status from cache
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const lastActivity = await cacheGet(`session:${user.user_id}`);
            return {
                ...user,
                is_online: !!lastActivity,
                last_activity: lastActivity ? JSON.parse(lastActivity).timestamp : null,
            };
        }));

        return reply.send({
            success: true,
            data: {
                users: enrichedUsers,
                total,
                page: parseInt(page),
                total_pages: Math.ceil(total / limit),
            },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 2. GET SINGLE USER DETAILS                  │
    // └─────────────────────────────────────────────┘
    async getUserDetail(request, reply) {
        const user = await User.findOne({ user_id: request.params.userId })
            .select('-password_hash')
            .lean();

        if (!user) throw new NotFoundError('User');

        // Get user's recent activity
        const recentActivity = await AuditLog.find({ user_id: user.user_id })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean();

        // Get login statistics
        const loginCount = await AuditLog.countDocuments({
            user_id: user.user_id,
            action: 'CREATE:AUTH',
            endpoint: '/auth/login',
        });

        const lastLogin = await AuditLog.findOne({
            user_id: user.user_id,
            action: 'CREATE:AUTH',
            endpoint: '/auth/login',
            status_code: 200,
        }).sort({ timestamp: -1 }).lean();

        return reply.send({
            success: true,
            data: {
                user,
                statistics: {
                    total_logins: loginCount,
                    last_login: lastLogin?.timestamp || user.last_login,
                    last_ip: lastLogin?.ip_address || null,
                    recent_activity: recentActivity,
                },
            },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 3. CREATE USER (admin-provisioned)          │
    // └─────────────────────────────────────────────┘
    async createUser(request, reply) {
        const data = validate(createUserSchema, request.body);

        // Check for existing user
        const existing = await User.findOne({
            $or: [{ email: data.email }, { username: data.username }],
        });
        if (existing) {
            throw new ValidationError('User with this email or username already exists');
        }

        const password_hash = await bcrypt.hash(data.password, 12);

        const user = new User({
            user_id: crypto.randomUUID(),
            username: data.username,
            email: data.email,
            password_hash,
            role: data.role,
            full_name: data.full_name,
            department: data.department || null,
            badge_number: data.badge_number || null,
            is_active: true, // Admin-created users are pre-approved
        });

        await user.save();

        logger.info({
            adminId: request.user.user_id,
            newUserId: user.user_id,
            role: data.role,
        }, 'Admin created new user');

        // Notify the new user
        await sendNotificationEmail(
            data.email,
            'Welcome to TraceVault – Account Created',
            `<h2>Welcome to TraceVault</h2>
             <p>Your account has been created by an administrator.</p>
             <p><strong>Username:</strong> ${data.username}</p>
             <p><strong>Role:</strong> ${data.role}</p>
             <p>Please log in and change your password immediately.</p>`
        );

        return reply.status(201).send({
            success: true,
            message: 'User created successfully',
            data: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
            },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 4. CHANGE USER ROLE                         │
    // └─────────────────────────────────────────────┘
    async changeUserRole(request, reply) {
        const { userId } = request.params;
        const data = validate(updateUserRoleSchema, request.body);

        const user = await User.findOne({ user_id: userId });
        if (!user) throw new NotFoundError('User');

        // Prevent self-demotion
        if (userId === request.user.user_id && data.role !== 'admin') {
            throw new ForbiddenError('Cannot demote yourself. Another admin must perform this action.');
        }

        const previousRole = user.role;
        user.role = data.role;
        await user.save();

        logger.info({
            adminId: request.user.user_id,
            targetUserId: userId,
            previousRole,
            newRole: data.role,
            reason: data.reason,
        }, 'Admin changed user role');

        // Alert on role changes
        await sendSecurityAlert('ROLE_CHANGE', {
            severity: data.role === 'admin' ? 'high' : 'medium',
            changed_by: request.user.user_id,
            admin_email: request.user.email || 'admin',
            target_user: userId,
            target_email: user.email,
            previous_role: previousRole,
            new_role: data.role,
            reason: data.reason || 'No reason provided',
        });

        // Notify the affected user
        await sendNotificationEmail(
            user.email,
            'TraceVault – Your Role Has Been Updated',
            `<h2>Role Update</h2>
             <p>Your role has been changed from <strong>${previousRole}</strong> to <strong>${data.role}</strong>.</p>
             <p><strong>Reason:</strong> ${data.reason || 'Administrative decision'}</p>
             <p>If you believe this is an error, contact your administrator immediately.</p>`
        );

        return reply.send({
            success: true,
            message: `User role changed from ${previousRole} to ${data.role}`,
            data: { user_id: userId, previous_role: previousRole, new_role: data.role },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 5. ACTIVATE / DEACTIVATE USER               │
    // └─────────────────────────────────────────────┘
    async updateUserStatus(request, reply) {
        const { userId } = request.params;
        const data = validate(updateUserStatusSchema, request.body);

        const user = await User.findOne({ user_id: userId });
        if (!user) throw new NotFoundError('User');

        // Prevent self-deactivation
        if (userId === request.user.user_id && !data.is_active) {
            throw new ForbiddenError('Cannot deactivate your own account');
        }

        const previousStatus = user.is_active;
        user.is_active = data.is_active;
        await user.save();

        // If deactivating, force logout by clearing their sessions
        if (!data.is_active) {
            await cacheDelete(`session:${userId}`);
        }

        logger.info({
            adminId: request.user.user_id,
            targetUserId: userId,
            previousStatus,
            newStatus: data.is_active,
            reason: data.reason,
        }, `Admin ${data.is_active ? 'activated' : 'deactivated'} user`);

        return reply.send({
            success: true,
            message: `User ${data.is_active ? 'activated' : 'deactivated'} successfully`,
            data: { user_id: userId, is_active: data.is_active },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 6. FORCE PASSWORD RESET                     │
    // └─────────────────────────────────────────────┘
    async forcePasswordReset(request, reply) {
        const { userId } = request.params;
        const { new_password } = request.body;

        if (!new_password || new_password.length < 8) {
            throw new ValidationError('New password must be at least 8 characters');
        }

        const user = await User.findOne({ user_id: userId });
        if (!user) throw new NotFoundError('User');

        user.password_hash = await bcrypt.hash(new_password, 12);
        await user.save();

        // Force logout
        await cacheDelete(`session:${userId}`);

        logger.info({
            adminId: request.user.user_id,
            targetUserId: userId,
        }, 'Admin forced password reset');

        // Notify user
        await sendNotificationEmail(
            user.email,
            'TraceVault – Password Reset by Administrator',
            `<h2>Password Reset</h2>
             <p>Your password has been reset by an administrator.</p>
             <p>Please log in with your new credentials and change your password immediately.</p>
             <p>If you did not request this, contact your administrator.</p>`
        );

        return reply.send({
            success: true,
            message: 'Password reset successfully. User has been logged out.',
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 7. BULK USER ACTIONS                        │
    // └─────────────────────────────────────────────┘
    async bulkAction(request, reply) {
        const data = validate(bulkActionSchema, request.body);
        const results = [];

        for (const userId of data.user_ids) {
            try {
                const user = await User.findOne({ user_id: userId });
                if (!user) {
                    results.push({ user_id: userId, status: 'not_found' });
                    continue;
                }

                // Prevent self-modification
                if (userId === request.user.user_id) {
                    results.push({ user_id: userId, status: 'skipped', reason: 'Cannot modify own account' });
                    continue;
                }

                switch (data.action) {
                    case 'activate':
                        user.is_active = true;
                        break;
                    case 'deactivate':
                        user.is_active = false;
                        await cacheDelete(`session:${userId}`);
                        break;
                    case 'force_password_reset':
                        const tempPassword = crypto.randomBytes(12).toString('hex');
                        user.password_hash = await bcrypt.hash(tempPassword, 12);
                        await cacheDelete(`session:${userId}`);
                        break;
                }

                await user.save();
                results.push({ user_id: userId, status: 'success' });
            } catch (err) {
                results.push({ user_id: userId, status: 'error', error: err.message });
            }
        }

        logger.info({
            adminId: request.user.user_id,
            action: data.action,
            targetCount: data.user_ids.length,
            results,
        }, 'Admin performed bulk action');

        return reply.send({
            success: true,
            message: `Bulk ${data.action} completed`,
            data: { results },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 8. SECURITY DASHBOARD                       │
    // └─────────────────────────────────────────────┘
    async securityDashboard(request, reply) {
        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeUsers,
            roleDistribution,
            failedLogins24h,
            totalRequests24h,
            recentErrors,
            topActiveUsers,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ is_active: true }),
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
            AuditLog.countDocuments({
                endpoint: '/auth/login',
                status_code: { $gte: 400 },
                timestamp: { $gte: last24h },
            }),
            AuditLog.countDocuments({ timestamp: { $gte: last24h } }),
            AuditLog.find({
                status_code: { $gte: 400 },
                timestamp: { $gte: last24h },
            }).sort({ timestamp: -1 }).limit(10).lean(),
            AuditLog.aggregate([
                { $match: { timestamp: { $gte: last7d }, user_id: { $ne: null } } },
                { $group: { _id: '$user_id', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
        ]);

        return reply.send({
            success: true,
            data: {
                overview: {
                    total_users: totalUsers,
                    active_users: activeUsers,
                    inactive_users: totalUsers - activeUsers,
                    role_distribution: roleDistribution.reduce((acc, r) => {
                        acc[r._id] = r.count;
                        return acc;
                    }, {}),
                },
                security: {
                    failed_logins_24h: failedLogins24h,
                    total_requests_24h: totalRequests24h,
                    recent_errors: recentErrors,
                    most_active_users: topActiveUsers,
                },
                generated_at: now.toISOString(),
            },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 9. DELETE USER (soft delete)                 │
    // └─────────────────────────────────────────────┘
    async deleteUser(request, reply) {
        const { userId } = request.params;

        if (userId === request.user.user_id) {
            throw new ForbiddenError('Cannot delete your own account');
        }

        const user = await User.findOne({ user_id: userId });
        if (!user) throw new NotFoundError('User');

        // Soft delete: deactivate and anonymize
        user.is_active = false;
        user.email = `deleted_${Date.now()}_${user.email}`;
        user.username = `deleted_${Date.now()}_${user.username}`;
        await user.save();

        await cacheDelete(`session:${userId}`);

        logger.info({
            adminId: request.user.user_id,
            deletedUserId: userId,
        }, 'Admin soft-deleted user');

        return reply.send({
            success: true,
            message: 'User account deactivated and anonymized',
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 10. EXPORT AUDIT LOGS                       │
    // └─────────────────────────────────────────────┘
    async exportAuditLogs(request, reply) {
        const { start_date, end_date, user_id, format = 'json' } = request.query;

        const filter = {};
        if (start_date || end_date) {
            filter.timestamp = {};
            if (start_date) filter.timestamp.$gte = new Date(start_date);
            if (end_date) filter.timestamp.$lte = new Date(end_date);
        }
        if (user_id) filter.user_id = user_id;

        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(5000)
            .lean();

        if (format === 'csv') {
            const headers = 'timestamp,user_id,method,endpoint,action,status_code,ip_address,response_time_ms\n';
            const rows = logs.map(l =>
                `${l.timestamp},${l.user_id || ''},${l.method},${l.endpoint},${l.action},${l.status_code},${l.ip_address || ''},${l.response_time_ms || ''}`
            ).join('\n');

            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
            return reply.send(headers + rows);
        }

        return reply.send({
            success: true,
            data: { logs, total: logs.length },
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 11. STATISTICS (Case & Evidence)             │
    // └─────────────────────────────────────────────┘
    async getStatistics(request, reply) {
        const [
            totalCases,
            activeCases,
            totalEvidence,
            evidenceSizeData,
            recentEvidence
        ] = await Promise.all([
            Case.countDocuments(),
            Case.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
            Evidence.countDocuments(),
            Evidence.aggregate([{ $group: { _id: null, totalBytes: { $sum: '$file_size' } } }]),
            Evidence.find().sort({ created_at: -1 }).limit(10).lean()
        ]);

        const totalStorageBytes = evidenceSizeData[0]?.totalBytes || 0;

        return reply.send({
            success: true,
            data: {
                cases: {
                    total: totalCases,
                    active: activeCases
                },
                evidence: {
                    total: totalEvidence,
                    total_storage_bytes: totalStorageBytes,
                    recent_uploads: recentEvidence
                }
            }
        });
    }

    // ┌─────────────────────────────────────────────┐
    // │ 12. TRIGGER INTEGRITY SCAN                  │
    // └─────────────────────────────────────────────┘
    async triggerIntegrityScan(request, reply) {
        logger.info({ adminId: request.user.user_id }, 'Admin manually triggered integrity scan');

        // Run asynchronously so we don't block the request
        runIntegrityVerificationJob().catch(err => {
            logger.error({ err }, 'Manual integrity scan failed');
        });

        // Log this important action
        await sendSecurityAlert('MANUAL_INTEGRITY_SCAN', {
            severity: 'medium',
            triggered_by: request.user.user_id,
            timestamp: new Date().toISOString()
        });

        return reply.send({
            success: true,
            message: 'Integrity scan triggered and running in the background'
        });
    }
}

export const adminController = new AdminController();
