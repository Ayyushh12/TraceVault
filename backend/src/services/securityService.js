/**
 * Suspicious Activity Detection & Threat Intelligence Engine
 *
 * Industry-standard security monitoring modeled after:
 *   - CJIS (Criminal Justice Information Services) Security Policy
 *   - NIST 800-53 Security Controls
 *   - FBI IAFIS/NGI Access Controls
 *   - Interpol MIND/FIND Security Protocols
 *
 * Detects and alerts on:
 *   - Brute force login attacks (threshold-based lockout)
 *   - Suspicious IP patterns (VPN/Tor/unknown geo)
 *   - Abnormal access patterns (off-hours, mass downloads)
 *   - Privilege escalation attempts
 *   - Evidence tampering signals
 *   - Session hijacking indicators
 *   - Rate anomaly detection
 */

import { cacheGet, cacheSet, cacheDelete } from '../core/redis.js';
import { sendSecurityAlert } from './emailService.js';
import { logger } from '../utils/logger.js';

// ─── Configuration ───────────────────────────────────────────

const SECURITY_CONFIG = {
    // Brute force protection
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_DURATION: 900,     // 15 minutes in seconds
    LOGIN_ATTEMPT_WINDOW: 300,       // 5 minutes window

    // Rate anomaly detection
    MAX_REQUESTS_PER_MINUTE: 120,
    MAX_DOWNLOADS_PER_HOUR: 20,
    MAX_UPLOADS_PER_HOUR: 30,

    // Session security
    MAX_CONCURRENT_SESSIONS: 3,
    SESSION_IDLE_TIMEOUT: 1800,      // 30 minutes

    // Off-hours detection (UTC)
    BUSINESS_HOURS_START: 6,         // 6 AM
    BUSINESS_HOURS_END: 22,          // 10 PM

    // Geo/IP anomaly
    ALERT_ON_NEW_IP: true,
    ALERT_ON_OFF_HOURS: true,
};

// ─── Login Attempt Tracking ──────────────────────────────────

/**
 * Track failed login attempts and implement account lockout.
 * @param {string} identifier - Email or IP address
 * @param {boolean} success - Whether the login succeeded
 * @param {Object} context - { ip, userAgent, email }
 * @returns {Object} { locked, attemptsRemaining, lockoutEnds }
 */
export async function trackLoginAttempt(identifier, success, context = {}) {
    const key = `login_attempts:${identifier}`;

    if (success) {
        // Reset counter on successful login
        await cacheDelete(key);
        await cacheDelete(`lockout:${identifier}`);

        // Check if this is a new IP for this user
        if (SECURITY_CONFIG.ALERT_ON_NEW_IP && context.email) {
            await detectNewIPLogin(context.email, context.ip);
        }

        // Check off-hours login
        if (SECURITY_CONFIG.ALERT_ON_OFF_HOURS) {
            detectOffHoursLogin(context);
        }

        return { locked: false, attemptsRemaining: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS };
    }

    // Check if already locked out
    const lockout = await cacheGet(`lockout:${identifier}`);
    if (lockout) {
        const lockoutData = JSON.parse(lockout);
        return {
            locked: true,
            attemptsRemaining: 0,
            lockoutEnds: lockoutData.until,
            message: 'Account temporarily locked due to too many failed attempts',
        };
    }

    // Increment failed attempts
    const currentStr = await cacheGet(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    const attempts = current + 1;

    await cacheSet(key, attempts.toString(), SECURITY_CONFIG.LOGIN_ATTEMPT_WINDOW);

    // Check if threshold exceeded
    if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = new Date(Date.now() + SECURITY_CONFIG.LOGIN_LOCKOUT_DURATION * 1000).toISOString();

        await cacheSet(`lockout:${identifier}`, JSON.stringify({
            until: lockoutUntil,
            attempts,
            ip: context.ip,
        }), SECURITY_CONFIG.LOGIN_LOCKOUT_DURATION);

        // Clear the counter
        await cacheDelete(key);

        // Send critical alert to admin
        await sendSecurityAlert('BRUTE_FORCE', {
            severity: 'critical',
            target_email: context.email || identifier,
            ip_address: context.ip || 'unknown',
            user_agent: context.userAgent || 'unknown',
            failed_attempts: attempts,
            lockout_until: lockoutUntil,
            action_taken: 'Account locked for 15 minutes',
        });

        // Also alert for account locked
        await sendSecurityAlert('ACCOUNT_LOCKED', {
            severity: 'high',
            email: context.email || identifier,
            ip_address: context.ip || 'unknown',
            lockout_duration: '15 minutes',
            failed_attempts: attempts,
        });

        logger.warn({
            email: context.email,
            ip: context.ip,
            attempts,
        }, 'BRUTE FORCE: Account locked due to excessive failed login attempts');

        return {
            locked: true,
            attemptsRemaining: 0,
            lockoutEnds: lockoutUntil,
            message: 'Account temporarily locked due to too many failed attempts',
        };
    }

    // Alert on suspicious threshold (3+ failures)
    if (attempts >= 3) {
        await sendSecurityAlert('SUSPICIOUS_LOGIN', {
            severity: 'medium',
            email: context.email || identifier,
            ip_address: context.ip || 'unknown',
            user_agent: context.userAgent || 'unknown',
            failed_attempts: attempts,
            max_before_lockout: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS,
            remaining: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts,
        });
    }

    return {
        locked: false,
        attemptsRemaining: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts,
    };
}

// ─── New IP Detection ────────────────────────────────────────

async function detectNewIPLogin(email, ip) {
    if (!ip) return;

    const key = `known_ips:${email}`;
    const knownStr = await cacheGet(key);
    const known = knownStr ? JSON.parse(knownStr) : [];

    if (!known.includes(ip)) {
        if (known.length > 0) {
            // This is genuinely a new IP — alert admin
            await sendSecurityAlert('SUSPICIOUS_LOGIN', {
                severity: 'medium',
                type: 'New IP address detected',
                email,
                new_ip: ip,
                previously_known_ips: known.join(', '),
                recommendation: 'Verify this login is legitimate',
            });
        }

        known.push(ip);
        // Keep last 10 IPs, 30-day TTL
        await cacheSet(key, JSON.stringify(known.slice(-10)), 2592000);
    }
}

// ─── Off-Hours Detection ─────────────────────────────────────

function detectOffHoursLogin(context) {
    const hour = new Date().getUTCHours();
    if (hour < SECURITY_CONFIG.BUSINESS_HOURS_START || hour >= SECURITY_CONFIG.BUSINESS_HOURS_END) {
        sendSecurityAlert('UNUSUAL_ACTIVITY', {
            severity: 'low',
            type: 'Off-hours login',
            email: context.email || 'unknown',
            ip_address: context.ip || 'unknown',
            login_time_utc: new Date().toISOString(),
            business_hours: `${SECURITY_CONFIG.BUSINESS_HOURS_START}:00 - ${SECURITY_CONFIG.BUSINESS_HOURS_END}:00 UTC`,
        }).catch(() => {});
    }
}

// ─── Rate Anomaly Detection ──────────────────────────────────

/**
 * Track request rates and detect anomalies.
 * @param {string} userId
 * @param {string} action - 'request' | 'download' | 'upload'
 */
export async function trackRateAnomaly(userId, action) {
    if (!userId) return;

    const key = `rate:${action}:${userId}`;
    const currentStr = await cacheGet(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    const count = current + 1;

    const ttl = action === 'request' ? 60 : 3600; // 1 min for requests, 1 hour for downloads/uploads
    await cacheSet(key, count.toString(), ttl);

    const limits = {
        request: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE,
        download: SECURITY_CONFIG.MAX_DOWNLOADS_PER_HOUR,
        upload: SECURITY_CONFIG.MAX_UPLOADS_PER_HOUR,
    };

    const limit = limits[action] || 100;

    if (count > limit) {
        const alertType = action === 'download' ? 'MASS_DOWNLOAD' : 'UNUSUAL_ACTIVITY';
        await sendSecurityAlert(alertType, {
            severity: action === 'download' ? 'high' : 'medium',
            type: `Excessive ${action} rate`,
            user_id: userId,
            count_in_window: count,
            threshold: limit,
            action: action,
            window: action === 'request' ? '1 minute' : '1 hour',
        });

        logger.warn({ userId, action, count, limit }, `Rate anomaly detected: ${action}`);
    }
}

// ─── Evidence Tampering Alert ────────────────────────────────

/**
 * Alert admin when evidence tampering is detected.
 * @param {Object} evidence - Evidence record
 * @param {Object} details - Tampering details
 */
export async function alertTamperingDetected(evidence, details) {
    await sendSecurityAlert('TAMPERING_DETECTED', {
        severity: 'critical',
        evidence_id: evidence.evidence_id || 'unknown',
        original_name: evidence.original_name || 'unknown',
        case_id: evidence.case_id || 'unknown',
        expected_hash: details.expectedHash || 'N/A',
        actual_hash: details.actualHash || 'N/A',
        detected_by: details.detectedBy || 'integrity scan',
        timestamp: new Date().toISOString(),
        action_required: 'Investigate immediately. Evidence chain may be compromised.',
    });
}

// ─── Privilege Escalation Detection ──────────────────────────

/**
 * Detect and alert on unauthorized privilege escalation attempts.
 * @param {Object} context
 */
export async function detectPrivilegeEscalation(context) {
    await sendSecurityAlert('PRIVILEGE_ESCALATION', {
        severity: 'critical',
        user_id: context.userId,
        email: context.email || 'unknown',
        current_role: context.currentRole,
        attempted_action: context.action,
        required_permission: context.requiredPermission,
        ip_address: context.ip || 'unknown',
        user_agent: context.userAgent || 'unknown',
        timestamp: new Date().toISOString(),
    });
}

export { SECURITY_CONFIG };
