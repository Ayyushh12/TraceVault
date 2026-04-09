/**
 * Email Alert Service – TraceVault
 *
 * Production-grade email alerting using Nodemailer with free SMTP providers.
 * Supports Gmail App Passwords, Outlook, or any custom SMTP relay.
 *
 * Sends real-time alerts to admin on:
 *   - Suspicious login attempts (brute force, unknown IPs)
 *   - Evidence tampering detected
 *   - New user registrations requiring approval
 *   - Role changes and privilege escalations
 *   - Account lockouts
 *   - Integrity verification failures
 *   - System-level security events
 */

import { createTransport } from 'nodemailer';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

// ─── Build SMTP transporter ─────────────────────────────────
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const smtpHost = config.email?.smtpHost;
    const smtpPort = config.email?.smtpPort;
    const smtpUser = config.email?.smtpUser;
    const smtpPass = config.email?.smtpPass;

    if (!smtpHost || !smtpUser || !smtpPass) {
        logger.warn('Email service not configured – alerts will be logged only');
        return null;
    }

    transporter = createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        tls: {
            rejectUnauthorized: false,
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        rateLimit: 5, // max 5 emails/sec
    });

    transporter.verify().then(() => {
        logger.info('✅ Email transporter verified and ready');
    }).catch((err) => {
        logger.error({ err }, 'Email transporter verification failed');
        transporter = null;
    });

    return transporter;
}

// ─── Alert Templates ─────────────────────────────────────────

const ALERT_TEMPLATES = {
    SUSPICIOUS_LOGIN: {
        subject: '🚨 SECURITY ALERT: Suspicious Login Attempt – TraceVault',
        priority: 'high',
    },
    BRUTE_FORCE: {
        subject: '🔴 CRITICAL: Brute Force Attack Detected – TraceVault',
        priority: 'high',
    },
    ACCOUNT_LOCKED: {
        subject: '🔒 Account Locked Due to Failed Attempts – TraceVault',
        priority: 'high',
    },
    TAMPERING_DETECTED: {
        subject: '⚠️ EVIDENCE TAMPERING DETECTED – TraceVault',
        priority: 'high',
    },
    NEW_REGISTRATION: {
        subject: '👤 New User Registration Pending Approval – TraceVault',
        priority: 'normal',
    },
    ROLE_CHANGE: {
        subject: '🔑 User Role/Permission Changed – TraceVault',
        priority: 'normal',
    },
    PRIVILEGE_ESCALATION: {
        subject: '🚨 PRIVILEGE ESCALATION ATTEMPT – TraceVault',
        priority: 'high',
    },
    INTEGRITY_FAILURE: {
        subject: '⚠️ Evidence Integrity Verification Failed – TraceVault',
        priority: 'high',
    },
    MASS_DOWNLOAD: {
        subject: '📥 Mass Evidence Download Detected – TraceVault',
        priority: 'normal',
    },
    UNUSUAL_ACTIVITY: {
        subject: '🔍 Unusual Activity Detected – TraceVault',
        priority: 'normal',
    },
};

// ─── HTML Email Builder ──────────────────────────────────────

function buildAlertHTML(alertType, details) {
    const timestamp = new Date().toISOString();
    const severityColor = details.severity === 'critical' ? '#dc2626'
        : details.severity === 'high' ? '#ea580c'
        : details.severity === 'medium' ? '#ca8a04'
        : '#059669';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
        <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;overflow:hidden;">
                <!-- Header -->
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:24px 28px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <table width="100%">
                                <tr>
                                    <td>
                                        <span style="font-size:20px;font-weight:700;color:#e2e8f0;letter-spacing:-0.02em;">🔬 TraceVault</span>
                                        <br>
                                        <span style="font-size:11px;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;">Security Alert System</span>
                                    </td>
                                    <td style="text-align:right;">
                                        <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${severityColor}20;color:${severityColor};font-size:11px;font-weight:600;text-transform:uppercase;border:1px solid ${severityColor}40;">
                                            ${details.severity || 'ALERT'}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 28px;">
                            <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#f1f5f9;">${ALERT_TEMPLATES[alertType]?.subject || 'Security Alert'}</h2>
                            
                            <!-- Details Table -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
                                ${Object.entries(details).map(([key, value]) => `
                                <tr>
                                    <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04);color:#94a3b8;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;width:140px;">${key.replace(/_/g, ' ')}</td>
                                    <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04);color:#e2e8f0;font-size:13px;font-family:monospace;">${String(value)}</td>
                                </tr>`).join('')}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 28px 24px;">
                            <p style="margin:0;font-size:11px;color:#475569;">
                                Timestamp: ${timestamp}<br>
                                This is an automated security alert from TraceVault Evidence Platform.<br>
                                Do not reply to this email. Log in to the admin panel to take action.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Core Send Function ──────────────────────────────────────

/**
 * Send a security alert email to the admin.
 * @param {string} alertType - One of ALERT_TEMPLATES keys
 * @param {Object} details - Key-value pairs for the alert body
 */
export async function sendSecurityAlert(alertType, details) {
    const adminEmail = config.email?.adminEmail;
    const template = ALERT_TEMPLATES[alertType];

    // Always log the alert regardless of email config
    logger.warn({ alertType, details }, `SECURITY ALERT: ${template?.subject || alertType}`);

    if (!adminEmail) {
        logger.warn('No admin email configured – alert logged only');
        return;
    }

    const transport = getTransporter();
    if (!transport) {
        logger.warn('Email transport unavailable – alert logged only');
        return;
    }

    try {
        const info = await transport.sendMail({
            from: `"TraceVault Security" <${config.email.smtpUser}>`,
            to: adminEmail,
            subject: template?.subject || `TraceVault Security Alert: ${alertType}`,
            html: buildAlertHTML(alertType, details),
            priority: template?.priority || 'normal',
            headers: {
                'X-TraceVault-Alert': alertType,
                'X-Priority': template?.priority === 'high' ? '1' : '3',
            },
        });

        logger.info({ messageId: info.messageId, alertType }, 'Security alert email sent');
    } catch (err) {
        logger.error({ err, alertType }, 'Failed to send security alert email');
    }
}

/**
 * Send a plain notification email (non-security).
 */
export async function sendNotificationEmail(to, subject, htmlContent) {
    const transport = getTransporter();
    if (!transport) {
        logger.warn({ to, subject }, 'Email transport unavailable');
        return;
    }

    try {
        await transport.sendMail({
            from: `"TraceVault Platform" <${config.email.smtpUser}>`,
            to,
            subject,
            html: htmlContent,
        });
    } catch (err) {
        logger.error({ err, to, subject }, 'Failed to send notification email');
    }
}

export { ALERT_TEMPLATES };
