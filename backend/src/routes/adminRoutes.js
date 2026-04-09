/**
 * Admin Routes – Super User Management API
 *
 * All routes require admin role authentication.
 * Every action is fully audit-logged automatically via the audit middleware.
 */

import { adminController } from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

export async function adminRoutes(app) {
    // All admin routes require authentication + admin role
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', requireRole('admin'));

    // ─── User Management ─────────────────────────────────
    
    // List all users (with search, filter, pagination)
    app.get('/admin/users', (req, reply) => adminController.listUsers(req, reply));

    // Get detailed user info + activity stats
    app.get('/admin/users/:userId', (req, reply) => adminController.getUserDetail(req, reply));

    // Create a new user (admin-provisioned)
    app.post('/admin/users', (req, reply) => adminController.createUser(req, reply));

    // Change user role (promote/demote)
    app.patch('/admin/users/:userId/role', (req, reply) => adminController.changeUserRole(req, reply));

    // Activate/Deactivate user account
    app.patch('/admin/users/:userId/status', (req, reply) => adminController.updateUserStatus(req, reply));

    // Force password reset
    app.post('/admin/users/:userId/reset-password', (req, reply) => adminController.forcePasswordReset(req, reply));

    // Soft delete user (anonymize + deactivate)
    app.delete('/admin/users/:userId', (req, reply) => adminController.deleteUser(req, reply));

    // ─── Bulk Operations ─────────────────────────────────

    // Bulk activate/deactivate/reset-password
    app.post('/admin/users/bulk', (req, reply) => adminController.bulkAction(req, reply));

    // ─── Security & Monitoring ───────────────────────────

    // Security overview dashboard
    app.get('/admin/security/dashboard', (req, reply) => adminController.securityDashboard(req, reply));

    // Export audit logs (JSON or CSV)
    app.get('/admin/audit/export', (req, reply) => adminController.exportAuditLogs(req, reply));

    // ─── System Data & Actions ───────────────────────────

    // Get Case & Evidence Statistics
    app.get('/admin/statistics', (req, reply) => adminController.getStatistics(req, reply));

    // Trigger manual integrity scan
    app.post('/admin/integrity/scan', (req, reply) => adminController.triggerIntegrityScan(req, reply));
}
