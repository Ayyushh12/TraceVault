/**
 * TraceVault – Centralized Configuration
 *
 * Reads ALL environment variables, applies defaults, and validates
 * required values at startup so the app fails fast if anything is
 * misconfigured.
 */

import dotenv from 'dotenv';
import crypto from 'node:crypto';
dotenv.config();

// ──────────────────────────────────────────────────────────────
// Helper: read env with an optional default (throws if required
// and not set)
// ──────────────────────────────────────────────────────────────
function env(key, defaultValue = undefined) {
    const value = process.env[key];
    if (value !== undefined && value !== '') return value;
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
}

function envInt(key, defaultValue = undefined) {
    return parseInt(env(key, defaultValue?.toString()), 10);
}

function envBool(key, defaultValue = false) {
    const val = env(key, defaultValue.toString());
    return val === 'true' || val === '1';
}

// ──────────────────────────────────────────────────────────────
// Build config object
// ──────────────────────────────────────────────────────────────
const config = {
    server: {
        port: envInt('PORT', 4000),
        host: env('HOST', '0.0.0.0'),
        env: env('NODE_ENV', 'development'),
        frontendUrl: env('FRONTEND_URL', 'http://localhost:8080'),
    },

    mongodb: {
        uri: env('MONGODB_URI', 'mongodb://localhost:27017/TraceVault'),
        dbName: env('MONGODB_DB_NAME', 'TraceVault'),
    },

    redis: {
        // Upstash REST-based Redis
        url: env('UPSTASH_REDIS_REST_URL', ''),
        token: env('UPSTASH_REDIS_REST_TOKEN', ''),
    },

    jwt: {
        secret: env('JWT_SECRET'),
        expiresIn: env('JWT_EXPIRES_IN', '8h'),
        refreshSecret: env('JWT_REFRESH_SECRET', ''),
        refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
    },

    storage: {
        driver: env('STORAGE_DRIVER', 'local'),
        local: {
            path: env('STORAGE_LOCAL_PATH', './storage/evidence'),
        },
        s3: {
            bucket: env('STORAGE_S3_BUCKET', ''),
            region: env('STORAGE_S3_REGION', ''),
            accessKey: env('STORAGE_S3_ACCESS_KEY', ''),
            secretKey: env('STORAGE_S3_SECRET_KEY', ''),
            endpoint: env('STORAGE_S3_ENDPOINT', ''),
        },
        fileHashAlgorithm: env('FILE_HASH_ALGORITHM', 'sha256'),
        maxFileSizeMB: envInt('FILE_MAX_SIZE_MB', 500),
        multipartUpload: envBool('S3_MULTIPART_UPLOAD', true),
        multipartThresholdMB: envInt('S3_MULTIPART_THRESHOLD_MB', 50),
        partSizeMB: envInt('S3_PART_SIZE_MB', 10),
    },

    encryption: {
        key: env('ENCRYPTION_KEY'),
        algorithm: env('ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
    },

    rateLimit: {
        max: envInt('RATE_LIMIT_MAX', 100),
        timeWindow: envInt('RATE_LIMIT_WINDOW_MS', 60000),
    },

    email: {
        smtpHost: env('SMTP_HOST', ''),
        smtpPort: envInt('SMTP_PORT', 587),
        smtpUser: env('SMTP_USER', ''),
        smtpPass: env('SMTP_PASS', ''),
        adminEmail: env('ADMIN_ALERT_EMAIL', ''),
    },

    cron: {
        ledgerAnchor: env('LEDGER_ANCHOR_CRON', '0 0 * * *'),
        integrityScan: env('INTEGRITY_SCAN_CRON', '0 2 * * *'),
        auditArchive: env('AUDIT_ARCHIVE_CRON', '0 3 * * 0'),
    },

    logging: {
        level: env('LOG_LEVEL', 'info'),
    },
};

// ──────────────────────────────────────────────────────────────
// Startup validation
// ──────────────────────────────────────────────────────────────
if (config.storage.driver === 's3') {
    const s3 = config.storage.s3;
    if (!s3.bucket || !s3.region || !s3.accessKey || !s3.secretKey) {
        throw new Error(
            'STORAGE_DRIVER=s3 requires STORAGE_S3_BUCKET, STORAGE_S3_REGION, ' +
            'STORAGE_S3_ACCESS_KEY, and STORAGE_S3_SECRET_KEY to be set.'
        );
    }
}

if (config.server.env === 'production') {
    if (config.jwt.secret === 'change-this-to-a-256-bit-secret-key-in-production') {
        throw new Error('JWT_SECRET must be changed from the default in production.');
    }
    // Auto-derive refresh secret from JWT_SECRET if not explicitly set
    if (!config.jwt.refreshSecret) {
        config.jwt.refreshSecret = crypto.createHash('sha256').update(config.jwt.secret + '-refresh').digest('hex');
    }
}

export default config;
