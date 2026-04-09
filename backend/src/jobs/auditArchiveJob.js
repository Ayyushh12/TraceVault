/**
 * Audit Log Archive Background Job
 *
 * Archives old audit logs by marking them.
 * Does not delete — maintains forensic traceability.
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../core/database.js';
import { auditService } from '../services/auditService.js';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

export async function runAuditArchiveJob(olderThanDays = 90) {
    logger.info({ olderThanDays }, 'Starting audit log archive job...');

    const wasConnected = mongoose.connection.readyState === 1;

    try {
        if (!wasConnected) {
            await connectDatabase();
        }
        const archived = await auditService.archiveLogs(olderThanDays);
        logger.info({ archived }, 'Audit log archive job completed');
        return archived;
    } catch (error) {
        logger.error({ err: error }, 'Audit log archive job failed');
        throw error;
    } finally {
        if (!wasConnected) {
            await disconnectDatabase();
        }
    }
}

export function scheduleAuditArchiveJob() {
    const cronExpression = config.cron.auditArchive;

    cron.schedule(cronExpression, async () => {
        logger.info('CRON: Audit archive job triggered');
        try {
            const archived = await auditService.archiveLogs(90);
            logger.info({ archived }, 'CRON: Audit archive job completed');
        } catch (error) {
            logger.error({ err: error }, 'CRON: Audit archive job failed');
        }
    });

    logger.info({ cron: cronExpression }, 'Audit archive job scheduled');
}

if (process.argv[1] && process.argv[1].includes('auditArchiveJob')) {
    runAuditArchiveJob().then(() => process.exit(0)).catch(() => process.exit(1));
}

