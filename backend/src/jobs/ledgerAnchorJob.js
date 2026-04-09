/**
 * Ledger Anchor Background Job
 *
 * Generates daily tamper-detection anchors.
 * Run via: npm run jobs:anchor
 * Or scheduled via node-cron in the main process.
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../core/database.js';
import { ledgerAnchorService } from '../services/ledgerAnchorService.js';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

export async function runLedgerAnchorJob() {
    logger.info('Starting ledger anchor generation job...');

    const wasConnected = mongoose.connection.readyState === 1;

    try {
        if (!wasConnected) {
            await connectDatabase();
        }
        const result = await ledgerAnchorService.generateDailyAnchor();
        logger.info({ result }, 'Ledger anchor job completed');
    } catch (error) {
        logger.error({ err: error }, 'Ledger anchor job failed');
    } finally {
        if (!wasConnected) {
            await disconnectDatabase();
        }
    }
}

export function scheduleLedgerAnchorJob() {
    const cronExpression = config.cron.ledgerAnchor;

    cron.schedule(cronExpression, async () => {
        logger.info('CRON: Ledger anchor job triggered');
        try {
            const result = await ledgerAnchorService.generateDailyAnchor();
            logger.info({ anchorDate: result.anchor_date }, 'CRON: Ledger anchor generated');
        } catch (error) {
            logger.error({ err: error }, 'CRON: Ledger anchor job failed');
        }
    });

    logger.info({ cron: cronExpression }, 'Ledger anchor job scheduled');
}

// Allow standalone execution
if (process.argv[1] && process.argv[1].includes('ledgerAnchorJob')) {
    runLedgerAnchorJob().then(() => process.exit(0)).catch(() => process.exit(1));
}

