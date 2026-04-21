import Fastify from 'fastify';
import crypto from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import config from './config.js';
import { logger } from '../utils/logger.js';

export async function buildServer() {
    const app = Fastify({
        logger: {
            level: config.logging.level,
            transport: config.server.env !== 'production'
                ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
                : undefined,
        },
        requestIdHeader: 'x-request-id',
        genReqId: () => crypto.randomUUID(),
        bodyLimit: 1048576, // 1MB for JSON body
    });

    // Security headers
    await app.register(helmet, {
        contentSecurityPolicy: false,
    });

    // Websocket
    await app.register(fastifyWebsocket);

    // CORS – lock to frontend URL in production
    let corsOrigins;
    if (config.server.env === 'production') {
        const rawOrigins = config.server.frontendUrl
            .split(',')
            .map(u => u.trim())
            .filter(Boolean)
            .map(u => {
                // Ensure each origin has a protocol prefix
                if (!u.startsWith('http://') && !u.startsWith('https://')) {
                    return `https://${u}`;
                }
                return u;
            });

        // Build a dynamic origin validator that also allows Vercel preview URLs
        corsOrigins = (origin, callback) => {
            // Allow requests with no origin (server-to-server, health checks)
            if (!origin) return callback(null, true);

            // Check exact matches first
            if (rawOrigins.includes(origin)) return callback(null, true);

            // Allow any *.vercel.app preview deployment
            if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
                return callback(null, true);
            }

            logger.warn({ origin, allowed: rawOrigins }, 'CORS: blocked request from unrecognized origin');
            callback(new Error('Not allowed by CORS'));
        };

        logger.info({ origins: rawOrigins }, 'CORS: production origins configured');
    } else {
        corsOrigins = true;
    }

    await app.register(cors, {
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'X-Hardware-ID', 'X-Device-Fingerprint'],
        exposedHeaders: ['x-request-id'],
    });

    // Rate limiting
    await app.register(rateLimit, {
        max: config.rateLimit.max,
        timeWindow: config.rateLimit.timeWindow,
        keyGenerator: (req) => req.ip,
    });

    // Multipart for file uploads – respect FILE_MAX_SIZE_MB
    const maxFileSize = config.storage.maxFileSizeMB * 1024 * 1024;
    await app.register(multipart, {
        limits: {
            fileSize: maxFileSize,
            files: 10,
        },
    });

    // JWT – access tokens
    await app.register(jwt, {
        secret: config.jwt.secret,
        sign: {
            expiresIn: config.jwt.expiresIn,
        },
    });

    // Store refresh token config on the app for the auth service to use
    app.decorate('refreshJwtConfig', {
        secret: config.jwt.refreshSecret,
        expiresIn: config.jwt.refreshExpiresIn,
    });



    // ─── OWASP Security Middleware ───────────────────────
    const {
        noSQLInjectionGuard,
        additionalSecurityHeaders,
        generateRequestFingerprint,
    } = await import('../middleware/owaspSecurity.js');

    // Additional security headers on every response
    app.addHook('onSend', additionalSecurityHeaders);

    // NoSQL injection guard on mutating requests
    app.addHook('preHandler', async (request, reply) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            await noSQLInjectionGuard(request, reply);
        }
    });

    // Attach device fingerprint for audit trail
    app.addHook('onRequest', async (request) => {
        request.deviceFingerprint = generateRequestFingerprint(request);
    });

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        logger.error({
            err: error,
            requestId: request.id,
            url: request.url,
            method: request.method,
        }, 'Unhandled error');

        if (error.validation) {
            return reply.status(400).send({
                error: 'Validation Error',
                message: error.message,
                statusCode: 400,
            });
        }

        if (error.statusCode) {
            return reply.status(error.statusCode).send({
                error: error.name || 'Error',
                message: error.message,
                statusCode: error.statusCode,
            });
        }

        return reply.status(500).send({
            error: 'Internal Server Error',
            message: config.server.env === 'production'
                ? 'An unexpected error occurred'
                : error.message,
            statusCode: 500,
        });
    });

    // 404 handler
    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            error: 'Not Found',
            message: `Route ${request.method} ${request.url} not found`,
            statusCode: 404,
        });
    });

    return app;
}
