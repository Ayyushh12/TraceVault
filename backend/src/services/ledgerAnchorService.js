/**
 * Ledger Anchor Service
 *
 * Daily tamper detection mechanism.
 * Collects all custody event hashes for a day,
 * creates a combined anchor hash, and stores it.
 * Each anchor references the previous anchor hash,
 * forming a secondary hash chain for database-level integrity.
 */

import crypto from 'node:crypto';
import LedgerAnchor from '../models/LedgerAnchor.js';
import { custodyService } from './custodyService.js';
import { generateAnchorHash } from '../crypto/cryptoEngine.js';
import { logger } from '../utils/logger.js';

export class LedgerAnchorService {
    /**
     * Generate anchor for a specific date.
     * @param {Date} date - The date to anchor (defaults to yesterday)
     * @returns {Promise<Object>}
     */
    async generateDailyAnchor(date = null) {
        if (!date) {
            date = new Date();
            date.setDate(date.getDate() - 1); // Yesterday
        }

        const anchorDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if anchor already exists for this date
        const existing = await LedgerAnchor.findOne({ anchor_date: anchorDate }).lean();
        if (existing) {
            logger.info({ anchorDate }, 'Ledger anchor already exists for date');
            return existing;
        }

        // Get the date range
        const startDate = new Date(`${anchorDate}T00:00:00.000Z`);
        const endDate = new Date(`${anchorDate}T23:59:59.999Z`);

        // Collect all event hashes for the day
        const eventHashes = await custodyService.getEventHashesByDateRange(startDate, endDate);

        if (eventHashes.length === 0) {
            logger.info({ anchorDate }, 'No custody events for anchor date, creating empty anchor');
        }

        // Generate combined anchor hash
        const anchorHash = eventHashes.length > 0
            ? generateAnchorHash(eventHashes)
            : generateAnchorHash([`empty:${anchorDate}`]);

        // Get previous anchor
        const previousAnchor = await LedgerAnchor.findOne()
            .sort({ created_at: -1 })
            .lean();

        const anchor = new LedgerAnchor({
            anchor_id: crypto.randomUUID(),
            anchor_date: anchorDate,
            anchor_hash: anchorHash,
            event_count: eventHashes.length,
            event_hashes: eventHashes,
            previous_anchor_hash: previousAnchor ? previousAnchor.anchor_hash : null,
        });

        await anchor.save();

        logger.info({
            anchorDate,
            anchorHash,
            eventCount: eventHashes.length,
        }, 'Ledger anchor generated');

        return anchor.toObject();
    }

    /**
     * Get latest anchor.
     */
    async getLatestAnchor() {
        return LedgerAnchor.findOne().sort({ created_at: -1 }).lean();
    }

    /**
     * Get anchor by date.
     */
    async getAnchorByDate(date) {
        return LedgerAnchor.findOne({ anchor_date: date }).lean();
    }

    /**
     * Get all anchors with pagination.
     */
    async getAnchors(page = 1, limit = 30) {
        const skip = (page - 1) * limit;
        const [anchors, total] = await Promise.all([
            LedgerAnchor.find()
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .select('-event_hashes')
                .lean(),
            LedgerAnchor.countDocuments(),
        ]);

        return {
            anchors,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    /**
     * Verify anchor chain integrity.
     */
    async verifyAnchorChain() {
        const anchors = await LedgerAnchor.find().sort({ created_at: 1 }).lean();

        if (anchors.length === 0) {
            return { valid: true, message: 'No anchors to verify', anchors_count: 0 };
        }

        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            const expectedPrev = i === 0 ? null : anchors[i - 1].anchor_hash;

            if (anchor.previous_anchor_hash !== expectedPrev) {
                return {
                    valid: false,
                    tampering_detected: true,
                    broken_anchor_id: anchor.anchor_id,
                    broken_anchor_date: anchor.anchor_date,
                    anchors_count: anchors.length,
                    message: `Anchor chain broken at ${anchor.anchor_date}`,
                };
            }

            // Verify anchor hash
            const recalculated = anchor.event_hashes.length > 0
                ? generateAnchorHash(anchor.event_hashes)
                : generateAnchorHash([`empty:${anchor.anchor_date}`]);

            if (recalculated !== anchor.anchor_hash) {
                return {
                    valid: false,
                    tampering_detected: true,
                    broken_anchor_id: anchor.anchor_id,
                    broken_anchor_date: anchor.anchor_date,
                    anchors_count: anchors.length,
                    message: `Anchor hash mismatch at ${anchor.anchor_date}`,
                };
            }
        }

        return {
            valid: true,
            tampering_detected: false,
            anchors_count: anchors.length,
            message: 'Anchor chain integrity verified',
        };
    }
}

export const ledgerAnchorService = new LedgerAnchorService();
