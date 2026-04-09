/**
 * OWASP Top 20 Security Middleware – TraceVault
 *
 * Comprehensive protection against:
 *  1. A01:2021 – Broken Access Control          → RBAC + resource-level checks
 *  2. A02:2021 – Cryptographic Failures          → AES-256-GCM, bcrypt(12), HTTPS enforcement
 *  3. A03:2021 – Injection                       → Zod validation, NoSQL injection guard, parameterized queries
 *  4. A04:2021 – Insecure Design                 → Defense-in-depth, principle of least privilege
 *  5. A05:2021 – Security Misconfiguration        → Helmet, strict CORS, no defaults in prod
 *  6. A06:2021 – Vulnerable Components            → Automated dep scanning (npm audit)
 *  7. A07:2021 – Auth Failures                   → JWT rotation, refresh token, brute force lock
 *  8. A08:2021 – Software & Data Integrity        → SHA-256 chain hashing, signed evidence
 *  9. A09:2021 – Logging & Monitoring Failures    → Forensic audit logs, real-time email alerts
 * 10. A10:2021 – SSRF                            → URL validation, internal network block
 * 11. Broken Function Level Authorization          → Per-endpoint permission checks
 * 12. Mass Assignment                             → Zod strict schemas, allowlist fields
 * 13. Insufficient Rate Limiting                  → Progressive throttling, per-user + global
 * 14. Unrestricted File Upload                    → MIME validation, size limits, sandbox storage
 * 15. Path Traversal                              → Filename sanitization
 * 16. CSRF                                        → SameSite cookies, CORS origin check
 * 17. XSS                                         → CSP headers, output encoding
 * 18. Information Disclosure                      → Error sanitization, no stack traces in prod
 * 19. Insecure Deserialization                    → JSON-only parsing, no eval
 * 20. Business Logic Vulnerabilities              → Evidence chain validation, dual-auth for critical ops
 */

import crypto from 'node:crypto';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { detectPrivilegeEscalation } from '../services/securityService.js';

// ─── 3. NoSQL Injection Prevention ───────────────────────────

const NOSQL_OPERATORS = ['$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in',
    '$or', '$and', '$not', '$nor', '$regex', '$where', '$exists',
    '$elemMatch', '$size', '$all', '$mod', '$type'];

/**
 * Deeply scan an object for NoSQL injection operators.
 * @param {any} obj
 * @param {string} path
 * @returns {boolean}
 */
function containsNoSQLInjection(obj, path = '') {
    if (obj === null || obj === undefined) return false;

    if (typeof obj === 'string') {
        // Check for embedded MongoDB operators in strings
        return NOSQL_OPERATORS.some(op => obj.includes(op));
    }

    if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            // Direct operator key
            if (NOSQL_OPERATORS.includes(key)) {
                logger.warn({ path: `${path}.${key}`, value }, 'NoSQL injection attempt detected');
                return true;
            }
            // Recurse into nested objects
            if (containsNoSQLInjection(value, `${path}.${key}`)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Middleware: Block NoSQL injection attempts in request body and query.
 */
export async function noSQLInjectionGuard(request, reply) {
    if (request.body && containsNoSQLInjection(request.body, 'body')) {
        logger.error({
            ip: request.ip,
            url: request.url,
            userId: request.user?.user_id,
        }, 'OWASP A03: NoSQL Injection attempt blocked');

        throw new ValidationError('Invalid request payload detected');
    }

    if (request.query && containsNoSQLInjection(request.query, 'query')) {
        logger.error({
            ip: request.ip,
            url: request.url,
        }, 'OWASP A03: NoSQL Injection in query params blocked');

        throw new ValidationError('Invalid query parameters detected');
    }
}

// ─── 15. Path Traversal Prevention ───────────────────────────

const PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e/gi,
    /%252e%252e/gi,
    /\.\./g,
];

/**
 * Sanitize a filename to prevent path traversal attacks.
 * @param {string} filename
 * @returns {string} sanitized filename
 */
export function sanitizeFilename(filename) {
    if (!filename) return 'unnamed';

    let sanitized = filename;
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Only allow safe characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9._\-\s]/g, '_');

    // Prevent hidden files
    if (sanitized.startsWith('.')) {
        sanitized = '_' + sanitized;
    }

    return sanitized || 'unnamed';
}

// ─── 14. File Upload Validation ──────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp',
    'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-7z-compressed', 'application/gzip',
    'application/octet-stream', // Generic binary (forensic evidence)
    'application/x-tar',
    'application/x-raw-disk-image',
]);

const BLOCKED_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe',
    '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps2',
    '.psc1', '.psc2', '.msi', '.msp', '.mst', '.cpl', '.hta',
    '.inf', '.ins', '.isp', '.reg', '.rgs', '.sct', '.dll', '.sys',
]);

/**
 * Validate uploaded file MIME type and extension.
 * @param {string} filename
 * @param {string} mimetype
 */
export function validateFileUpload(filename, mimetype) {
    const ext = (filename || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';

    // Block dangerous extensions
    if (BLOCKED_EXTENSIONS.has(ext)) {
        logger.warn({ filename, mimetype, ext }, 'OWASP A14: Blocked dangerous file extension');
        throw new ValidationError(`File extension '${ext}' is not allowed for security reasons`);
    }

    // MIME type validation (relaxed for forensic evidence)
    if (mimetype && !ALLOWED_MIME_TYPES.has(mimetype) && !mimetype.startsWith('application/')) {
        logger.warn({ filename, mimetype }, 'OWASP A14: Suspicious MIME type');
        // Log but don't block — forensic evidence can be any format
    }
}

// ─── 17. XSS Prevention ─────────────────────────────────────

const XSS_PATTERNS = [
    /<script[\s>]/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:\s*text\/html/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /expression\s*\(/gi,
    /eval\s*\(/gi,
];

/**
 * Sanitize a string to prevent XSS.
 * @param {string} input
 * @returns {string}
 */
export function sanitizeXSS(input) {
    if (typeof input !== 'string') return input;

    let sanitized = input;
    sanitized = sanitized.replace(/&/g, '&amp;');
    sanitized = sanitized.replace(/</g, '&lt;');
    sanitized = sanitized.replace(/>/g, '&gt;');
    sanitized = sanitized.replace(/"/g, '&quot;');
    sanitized = sanitized.replace(/'/g, '&#x27;');
    return sanitized;
}

/**
 * Check if input contains XSS patterns.
 * @param {string} input
 * @returns {boolean}
 */
export function containsXSS(input) {
    if (typeof input !== 'string') return false;
    return XSS_PATTERNS.some(pattern => pattern.test(input));
}

// ─── 18. Information Disclosure Prevention ───────────────────

/**
 * Sanitize error responses to prevent information disclosure.
 * @param {Error} error
 * @param {string} env
 * @returns {Object} sanitized error response
 */
export function sanitizeErrorResponse(error, env = 'production') {
    const response = {
        error: error.name || 'Error',
        message: error.message,
        statusCode: error.statusCode || 500,
    };

    // In production, strip stack traces and internal details
    if (env === 'production') {
        if (response.statusCode >= 500) {
            response.message = 'An internal error occurred. Please contact support.';
        }
        // Never expose stack traces
        delete response.stack;
        // Never expose internal error codes
        delete response.code;
    }

    return response;
}

// ─── 11. Broken Function Level Authorization ─────────────────

/**
 * Enhanced permission check with privilege escalation detection.
 * @param {string} permission
 * @param {Object} options
 */
export function requirePermissionSecure(permission, options = {}) {
    return async (request, reply) => {
        const user = request.user;

        if (!user || !user.role) {
            throw new ForbiddenError('Authentication required');
        }

        // Import RBAC permissions
        const { ROLE_PERMISSIONS } = await import('./rbac.js');
        const permissions = ROLE_PERMISSIONS[user.role];

        if (!permissions || !permissions.includes(permission)) {
            // Log the escalation attempt
            await detectPrivilegeEscalation({
                userId: user.user_id,
                email: user.email,
                currentRole: user.role,
                action: `${request.method} ${request.url}`,
                requiredPermission: permission,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            });

            throw new ForbiddenError(
                `Insufficient permissions. Required: ${permission}`
            );
        }

        // Log admin actions for audit
        if (options.logAction && user.role === 'admin') {
            logger.info({
                userId: user.user_id,
                permission,
                url: request.url,
                method: request.method,
            }, `Admin action: ${permission}`);
        }
    };
}

// ─── 10. SSRF Prevention ─────────────────────────────────────

const INTERNAL_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
    /localhost/i,
];

/**
 * Validate a URL to prevent SSRF attacks.
 * @param {string} url
 * @returns {boolean}
 */
export function isInternalURL(url) {
    try {
        const parsed = new URL(url);
        return INTERNAL_RANGES.some(pattern => pattern.test(parsed.hostname));
    } catch {
        return true; // Invalid URLs are treated as suspicious
    }
}

// ─── Security Headers Middleware ─────────────────────────────

/**
 * Additional security headers beyond what Helmet provides.
 */
export async function additionalSecurityHeaders(request, reply) {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
}

// ─── Request Fingerprinting ─────────────────────────────────


/**
 * Generate a device fingerprint from request headers.
 * Used for session binding and anomaly detection.
 */
export function generateRequestFingerprint(request) {
    const components = [
        request.headers['user-agent'] || '',
        request.headers['accept-language'] || '',
        request.headers['accept-encoding'] || '',
        request.ip || '',
    ];

    return crypto
        .createHash('sha256')
        .update(components.join('|'))
        .digest('hex')
        .substring(0, 16);
}
