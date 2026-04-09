/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Roles hierarchy:
 *   admin > investigator > auditor
 *
 * Permissions matrix:
 *   admin:        Full access
 *   investigator: Upload, transfer, view, verify evidence
 *   auditor:      Read-only, verify, view audit logs
 */

import { ForbiddenError } from '../utils/errors.js';

const ROLE_PERMISSIONS = {
    admin: [
        // Evidence operations
        'evidence:upload',
        'evidence:view',
        'evidence:download',
        'evidence:transfer',
        'evidence:verify',
        'evidence:export',
        'evidence:sign',
        'evidence:delete',
        'evidence:seal',           // Mark evidence as sealed/classified
        'evidence:unseal',         // Remove seal from evidence
        // Custody operations
        'custody:view',
        'custody:transfer',
        // Case operations
        'case:create',
        'case:view',
        'case:update',
        'case:delete',
        'case:archive',           // Archive closed cases
        'case:classify',          // Change case classification level
        // Audit operations
        'audit:view',
        'audit:export',           // Export audit logs (CSV/JSON)
        'audit:archive',          // Archive old audit logs
        // Report operations
        'report:generate',
        'report:view',
        // Ledger operations
        'ledger:view',
        // User/Team management (SUPER USER)
        'user:manage',            // Full CRUD on users
        'user:create',            // Create new users
        'user:activate',          // Activate/deactivate accounts
        'user:role_change',       // Change user roles
        'user:password_reset',    // Force password resets
        'user:delete',            // Soft delete users
        'user:bulk_action',       // Bulk operations on users
        // Security & System (SUPER USER)
        'security:dashboard',     // View security dashboard
        'security:alerts',        // View/manage security alerts
        'security:config',        // Runtime system configuration
        'system:settings',        // Platform-level settings
    ],
    investigator: [
        'evidence:upload',
        'evidence:view',
        'evidence:download',
        'evidence:transfer',
        'evidence:verify',
        'evidence:export',
        'evidence:sign',
        'custody:view',
        'custody:transfer',
        'custody:verify',
        'case:create',
        'case:view',
        'case:update',
        'report:generate',
        'report:view',
        'ledger:view',
        'audit:view',
    ],
    auditor: [
        'evidence:view',
        'evidence:verify',
        'evidence:download',
        'custody:view',
        'custody:verify',
        'case:view',
        'audit:view',
        'report:view',
        'ledger:view',
    ],
    viewer: [
        'evidence:view',
        'custody:view',
        'case:view',
        'ledger:view',
    ],
};

/**
 * Create RBAC middleware that checks for required permission.
 * @param {string} permission - Required permission string
 * @returns {Function} Fastify preHandler
 */
export function requirePermission(permission) {
    return async (request, reply) => {
        const user = request.user;

        if (!user || !user.role) {
            throw new ForbiddenError('No role assigned to user');
        }

        const permissions = ROLE_PERMISSIONS[user.role];

        if (!permissions) {
            throw new ForbiddenError(`Unknown role: ${user.role}`);
        }

        if (!permissions.includes(permission)) {
            throw new ForbiddenError(
                `Role '${user.role}' does not have permission '${permission}'`
            );
        }
    };
}

/**
 * Check if any of the listed permissions is satisfied.
 * @param {string[]} permissions
 * @returns {Function}
 */
export function requireAnyPermission(permissions) {
    return async (request, reply) => {
        const user = request.user;

        if (!user || !user.role) {
            throw new ForbiddenError('No role assigned to user');
        }

        const userPermissions = ROLE_PERMISSIONS[user.role];

        if (!userPermissions) {
            throw new ForbiddenError(`Unknown role: ${user.role}`);
        }

        const hasAny = permissions.some((p) => userPermissions.includes(p));

        if (!hasAny) {
            throw new ForbiddenError(
                `Role '${user.role}' does not have any of the required permissions`
            );
        }
    };
}

/**
 * Restrict to specific roles.
 * @param {string[]} roles
 * @returns {Function}
 */
export function requireRole(...roles) {
    return async (request, reply) => {
        const user = request.user;

        if (!user || !user.role) {
            throw new ForbiddenError('No role assigned to user');
        }

        if (!roles.includes(user.role)) {
            throw new ForbiddenError(
                `This action requires one of the following roles: ${roles.join(', ')}`
            );
        }
    };
}

export { ROLE_PERMISSIONS };
