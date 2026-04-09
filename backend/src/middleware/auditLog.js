/**
 * Forensic Audit Logging Middleware
 *
 * Every API request creates an immutable audit log entry.
 */

import crypto from 'node:crypto';
import AuditLog from '../models/AuditLog.js';
import { MCPContextManager } from '../mcp/contextManager.js';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notificationService.js';

// Sensitive fields to redact from request body
const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'secret', 'private_key'];

function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return null;

    const sanitized = { ...body };
    for (const field of SENSITIVE_FIELDS) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}

function deriveAction(method, url) {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    // Use the first segment (resource name: 'evidence', 'cases', etc.)
    // NOT the second segment which is usually the ID
    const resource = parts[0] || 'unknown';

    // Map sub-resources for timeline tracking
    // e.g., /evidence/:id/verify → 'evidence_verify'
    const subAction = parts.length >= 3 ? parts[parts.length - 1] : null;
    const subActionMap = {
        'verify': 'evidence_verify',
        'validate-chain': 'evidence_verify',
        'analyze': 'evidence_access',
        'download': 'evidence_download',
        'upload': 'evidence_upload',
    };

    // If this is a known sub-action on evidence, use the enriched action name
    if (resource.toLowerCase() === 'evidence' && subAction && subActionMap[subAction]) {
        return subActionMap[subAction];
    }

    const methodMap = {
        GET: 'READ',
        POST: 'CREATE',
        PUT: 'UPDATE',
        PATCH: 'UPDATE',
        DELETE: 'DELETE',
    };

    return `${methodMap[method] || method}:${resource.toUpperCase()}`;
}

/**
 * Register audit logging hooks on the Fastify instance.
 * @param {import('fastify').FastifyInstance} app
 */
export function registerAuditHooks(app) {
    // Lazy mcpContext: built on first access, AFTER auth middleware has run
    app.addHook('onRequest', async (request) => {
        request.startTime = Date.now();
        // Use Object.defineProperty so mcpContext is lazily evaluated
        // after authenticate() has decoded the JWT and set request.user
        Object.defineProperty(request, 'mcpContext', {
            get() {
                return MCPContextManager.fromRequest(request);
            },
            configurable: true,
            enumerable: false,
        });
    });

    // Log after response is sent
    app.addHook('onResponse', async (request, reply) => {
        try {
            // Skip health check and static assets
            if (request.url === '/health' || request.url.startsWith('/static')) {
                return;
            }

            const context = request.mcpContext || MCPContextManager.fromRequest(request);

            const auditEntry = new AuditLog({
                log_id: crypto.randomUUID(),
                request_id: context.request_id,
                user_id: context.user_id,
                user_role: context.role,
                actor_name: context.username || null,
                method: request.method,
                endpoint: request.url.split('?')[0],
                action: deriveAction(request.method, request.url),
                status_code: reply.statusCode,
                ip_address: context.ip_address,
                mac_address: context.mac_address,
                device_fingerprint: context.device_fingerprint,
                user_agent: request.headers['user-agent'] || null,
                request_body: request.method !== 'GET' ? sanitizeBody(request.body) : null,
                response_time_ms: Date.now() - (request.startTime || Date.now()),
                error_message: reply.statusCode >= 400 ? (request.errorMessage || null) : null,
                timestamp: new Date(context.timestamp),
            });

            // Non-blocking save
            auditEntry.save().catch((err) => {
                logger.error({ err }, 'Failed to save audit log');
            });

            // ─── THREAT INTELLIGENCE NOTIFICATIONS ───
            if (context.user_id) {
                const hour = auditEntry.timestamp.getHours();
                const isOffHours = hour < 6 || hour >= 22; // 22:00 to 05:59
                const action = auditEntry.action || '';
                
                // 1. Unauthorized Access
                if (reply.statusCode === 401 || reply.statusCode === 403) {
                     notificationService.createNotification(
                         context.user_id,
                         'UNAUTHORIZED_ACCESS',
                         'Unauthorized Access Attempt',
                         `A ${reply.statusCode} violation was logged for ${action} on ${auditEntry.endpoint}.`,
                         { log_id: auditEntry.log_id, endpoint: auditEntry.endpoint },
                         '/activity'
                     ).catch(() => {}); // non-blocking
                }
                
                // 2. Off-Hours Modification (Non-GET)
                if (isOffHours && reply.statusCode < 400 && request.method !== 'GET') {
                     notificationService.createNotification(
                         context.user_id,
                         'OFF_HOURS_ACCESS',
                         'Off-Hours Operations',
                         `An anomalous modification (${action}) occurred at ${auditEntry.timestamp.toTimeString().split(' ')[0]}, outside of standard hours.`,
                         { log_id: auditEntry.log_id, hour },
                         '/activity'
                     ).catch(() => {});
                }
                
                // 3. Destructive Actions
                if (action.includes('DELETE') && reply.statusCode < 400) {
                     notificationService.createNotification(
                         context.user_id,
                         'ADMIN_ACTION',
                         'Destructive Action Logged',
                         `A delete operation was successfully executed on ${auditEntry.endpoint}.`,
                         { log_id: auditEntry.log_id },
                         '/activity'
                     ).catch(() => {});
                }
            }
        } catch (err) {
            logger.error({ err }, 'Audit logging hook error');
        }
    });

    // Capture error messages for audit
    app.addHook('onError', async (request, reply, error) => {
        request.errorMessage = error.message;
    });
}
