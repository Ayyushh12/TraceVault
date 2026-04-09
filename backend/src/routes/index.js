/**
 * Route Index – Registers all route modules
 */

import { authRoutes } from './authRoutes.js';
import { caseRoutes } from './caseRoutes.js';
import { evidenceRoutes } from './evidenceRoutes.js';
import { custodyRoutes } from './custodyRoutes.js';
import { verificationRoutes } from './verificationRoutes.js';
import { auditRoutes } from './auditRoutes.js';
import { ledgerRoutes } from './ledgerRoutes.js';
import { reportRoutes } from './reportRoutes.js';
import { userRoutes } from './userRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { threatIntelRoutes } from './threatIntelRoutes.js';
import { sessionRoutes } from './sessionRoutes.js';
import { evidenceTimelineRoutes } from './evidenceTimelineRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import mongoose from 'mongoose';
import os from 'node:os';
import { isRedisAvailable } from '../core/redis.js';

export async function registerRoutes(app) {
    await app.register(authRoutes);
    await app.register(caseRoutes);
    await app.register(evidenceRoutes);
    await app.register(custodyRoutes);
    await app.register(verificationRoutes);
    await app.register(auditRoutes);
    await app.register(ledgerRoutes);
    await app.register(reportRoutes);
    await app.register(userRoutes);
    await app.register(adminRoutes);
    await app.register(dashboardRoutes);
    await app.register(threatIntelRoutes);
    await app.register(sessionRoutes);
    await app.register(evidenceTimelineRoutes);
    await app.register(notificationRoutes);

    // ─── System Health & Monitoring ────────────────────
    app.get('/health', async (req, reply) => {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const redisStatus = isRedisAvailable() ? 'connected' : 'disconnected';
        
        reply.send({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            metrics: {
                memory_usage: process.memoryUsage(),
                cpu_load: os.loadavg(),
                active_users: 0,
            },
            services: {
                database: dbStatus,
                redis: redisStatus,
            }
        });
    });
}
