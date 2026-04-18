/**
 * TraceVault – Digital Evidence Integrity & Chain-of-Custody Platform
 *
 * Main application entry point.
 *
 * Initializes:
 *   - Fastify server with security plugins
 *   - MongoDB connection
 *   - Redis cache (optional)
 *   - Audit logging hooks
 *   - All API routes
 *   - Background job schedulers
 *   - Database indexes
 */

import { buildServer } from './core/server.js';
import { connectDatabase, createIndexes } from './core/database.js';
import { connectRedis } from './core/redis.js';
import { registerAuditHooks } from './middleware/auditLog.js';
import { registerRoutes } from './routes/index.js';
import { scheduleLedgerAnchorJob } from './jobs/ledgerAnchorJob.js';
import { scheduleIntegrityVerificationJob } from './jobs/integrityVerificationJob.js';
import { scheduleAuditArchiveJob } from './jobs/auditArchiveJob.js';
import config from './core/config.js';
import { logger } from './utils/logger.js';
import { execSync } from 'node:child_process';

let app = null;

/**
 * Kill whatever process is using a given port (cross-platform).
 */
function killPort(port) {
    const isWindows = process.platform === 'win32';
    try {
        if (isWindows) {
            const result = execSync(
                `cmd /c "netstat -aon | findstr :${port} | findstr LISTENING"`,
                { encoding: 'utf-8', timeout: 5000 }
            ).trim();

            const lines = result.split('\n').filter(Boolean);
            for (const line of lines) {
                const pid = line.trim().split(/\s+/).pop();
                if (pid && pid !== '0') {
                    logger.warn(`Killing old process on port ${port} (PID ${pid})...`);
                    try {
                        execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
                    } catch {
                        // Process may have already exited
                    }
                }
            }
        } else {
            // Linux / macOS
            const result = execSync(
                `lsof -ti:${port} 2>/dev/null || true`,
                { encoding: 'utf-8', timeout: 5000 }
            ).trim();

            if (result) {
                const pids = result.split('\n').filter(Boolean);
                for (const pid of pids) {
                    logger.warn(`Killing old process on port ${port} (PID ${pid})...`);
                    try {
                        execSync(`kill -9 ${pid}`, { timeout: 5000 });
                    } catch {
                        // Process may have already exited
                    }
                }
            }
        }
        return true;
    } catch {
        return false; // No process found on port or command failed
    }
}

async function startServer(retryCount = 0) {
    try {
        await app.listen({
            port: config.server.port,
            host: config.server.host,
        });
        return true;
    } catch (error) {
        if (error.code === 'EADDRINUSE' && retryCount < 2) {
            logger.warn(`Port ${config.server.port} in use. Attempting to free it...`);
            killPort(config.server.port);
            // Wait a moment for the port to release
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return startServer(retryCount + 1);
        }
        throw error;
    }
}

async function main() {
    try {
        logger.info('╔══════════════════════════════════════════════════╗');
        logger.info('║   TraceVault – Digital Evidence Platform         ║');
        logger.info('║   Version 1.0.0                                  ║');
        logger.info('╚══════════════════════════════════════════════════╝');

        // Step 1: Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await connectDatabase();

        // Step 2: Create database indexes
        logger.info('Creating database indexes...');
        await createIndexes();

        // Step 3: Connect to Redis (non-blocking, optional)
        logger.info('Connecting to Redis...');
        await connectRedis();

        // Step 4: Build Fastify server
        logger.info('Building server...');
        app = await buildServer();

        // Step 5: Register audit logging hooks
        registerAuditHooks(app);

        // Step 6: Register all routes
        await registerRoutes(app);

        // Step 7: Schedule background jobs
        scheduleLedgerAnchorJob();
        scheduleIntegrityVerificationJob();
        scheduleAuditArchiveJob();

        // Step 8: Start server (with EADDRINUSE auto-recovery)
        await startServer();

        logger.info(`Server running at http://${config.server.host}:${config.server.port}`);
        logger.info(`Environment: ${config.server.env}`);
        logger.info('All systems operational ✓');

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);
            if (app) {
                await app.close();
            }
            logger.info('Server closed');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        logger.error({ err: error }, 'Failed to start TraceVault');
        process.exit(1);
    }
}

main();

