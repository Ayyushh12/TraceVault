/**
 * Evidence Integrity Verification Background Job
 *
 * Scans all active evidence and verifies:
 *   - File hash integrity
 *   - Custody chain integrity
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../core/database.js';
import { verificationService } from '../services/verificationService.js';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

export async function runIntegrityVerificationJob() {
    logger.info('Starting integrity verification scan...');

    // Only manage DB connection if not already connected (standalone execution)
    const wasConnected = mongoose.connection.readyState === 1;

    try {
        if (!wasConnected) {
            await connectDatabase();
        }
        const results = await verificationService.verifyAllEvidence();
        logger.info({
            total: results.total,
            passed: results.passed,
            failed: results.failed,
        }, 'Integrity verification scan completed');
        return results;
    } catch (error) {
        logger.error({ err: error }, 'Integrity verification scan failed');
        throw error;
    } finally {
        // Only disconnect if WE created the connection
        if (!wasConnected) {
            await disconnectDatabase();
        }
    }
}

export function scheduleIntegrityVerificationJob() {
    const cronExpression = config.cron.integrityScan;

    cron.schedule(cronExpression, async () => {
        logger.info('CRON: Integrity verification scan triggered');
        try {
            const results = await verificationService.verifyAllEvidence();
            logger.info({
                total: results.total,
                passed: results.passed,
                failed: results.failed,
            }, 'CRON: Integrity verification scan completed');
        } catch (error) {
            logger.error({ err: error }, 'CRON: Integrity verification scan failed');
        }
    });

    logger.info({ cron: cronExpression }, 'Integrity verification job scheduled');
}

if (process.argv[1] && process.argv[1].includes('integrityVerificationJob')) {
    runIntegrityVerificationJob().then(() => process.exit(0)).catch(() => process.exit(1));
}

