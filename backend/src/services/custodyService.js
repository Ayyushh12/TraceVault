/**
 * Custody Service
 *
 * Manages the immutable chain of custody events.
 * Each event references the previous event hash, creating a hash chain.
 */

import crypto from 'node:crypto';
import CustodyEvent from '../models/CustodyEvent.js';
import Evidence from '../models/Evidence.js';
import { generateEventHash, verifyEventHash } from '../crypto/cryptoEngine.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { notificationService } from './notificationService.js';

export class CustodyService {
    /**
     * Create a new custody event in the hash chain.
     * @param {Object} eventData
     * @param {Object} mcpContext
     * @returns {Promise<Object>}
     */
    async createEvent(eventData, mcpContext) {
        // Get the latest event for this evidence to chain hashes
        const lastEvent = await CustodyEvent.findOne({
            evidence_id: eventData.evidence_id,
        })
            .sort({ timestamp: -1 })
            .lean();

        const previousEventHash = lastEvent ? lastEvent.event_hash : null;
        const timestamp = new Date().toISOString();

        // Generate tamper-evident event hash
        const eventHash = generateEventHash({
            evidence_id: eventData.evidence_id,
            previous_event_hash: previousEventHash,
            actor_id: eventData.actor_id,
            action_type: eventData.action,
            timestamp,
            device_fingerprint: mcpContext.device_fingerprint,
            ip_address: mcpContext.ip_address,
        });

        const event = new CustodyEvent({
            event_id: crypto.randomUUID(),
            evidence_id: eventData.evidence_id,
            action: eventData.action,
            actor_id: eventData.actor_id,
            actor_name: eventData.actor_name,
            actor_role: eventData.actor_role,
            previous_event_hash: previousEventHash,
            event_hash: eventHash,
            ip_address: mcpContext.ip_address,
            device_fingerprint: mcpContext.device_fingerprint,
            geo_location: mcpContext.geo_location,
            details: eventData.details || {},
            request_id: mcpContext.request_id,
            timestamp: new Date(timestamp),
        });

        await event.save();

        logger.debug({
            eventId: event.event_id,
            evidenceId: eventData.evidence_id,
            action: eventData.action,
        }, 'Custody event created');

        return event.toObject();
    }

    /**
     * Transfer custody of evidence to another user.
     */
    async transferCustody(evidenceId, newCustodianId, reason, mcpContext) {
        const evidence = await Evidence.findOne({
            evidence_id: evidenceId,
            status: 'active',
        });

        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        if (evidence.is_locked && evidence.lock_expiry && new Date(evidence.lock_expiry) > new Date()) {
            throw new ValidationError(`Evidence is legally locked. Chain of custody transfer is prohibited until ${evidence.lock_expiry.toISOString()}`);
        }

        const previousCustodian = evidence.current_custodian;

        // Update custodian
        evidence.current_custodian = newCustodianId;
        await evidence.save();

        // Create custody transfer event
        const event = await this.createEvent({
            evidence_id: evidenceId,
            action: 'TRANSFER_CUSTODY',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: {
                from_custodian: previousCustodian,
                to_custodian: newCustodianId,
                reason: reason || 'Custody transfer',
            },
        }, mcpContext);

        logger.info({
            evidenceId,
            from: previousCustodian,
            to: newCustodianId,
        }, 'Custody transferred');

        // ─── THREAT INTELLIGENCE NOTIFICATIONS ───
        try {
            const evidenceName = evidence.original_name || evidence.file_name || evidenceId;
            const actionUrl = `/evidence/${evidenceId}`;
            
            // Notify receiver
            if (newCustodianId) {
                notificationService.createNotification(
                    newCustodianId,
                    'CUSTODY_TRANSFERRED',
                    'Custody Transferred',
                    `Evidence '${evidenceName}' is now in your legal custody. Reason: ${reason}`,
                    { evidence_id: evidenceId, event_hash: event.event_hash },
                    actionUrl
                );
            }
            
            // Notify previous custodian if they exist and aren't the receiver
            if (previousCustodian && previousCustodian !== newCustodianId) {
                notificationService.createNotification(
                    previousCustodian,
                    'CUSTODY_TRANSFERRED',
                    'Custody Relinquished',
                    `Your custody of '${evidenceName}' has formally ended and transferred to ${newCustodianId}.`,
                    { evidence_id: evidenceId, event_hash: event.event_hash },
                    actionUrl
                );
            }
        } catch (err) {
            logger.error({ err }, 'Failed to dispatch custody notifications');
        }

        return {
            evidence_id: evidenceId,
            previous_custodian: previousCustodian,
            new_custodian: newCustodianId,
            event_hash: event.event_hash,
            timestamp: event.timestamp,
        };
    }

    /**
     * Get custody chain (all events) for a piece of evidence.
     * Supports filtering by action, actor_id, startDate, endDate.
     */
    async getCustodyChain(evidenceId, filters = {}) {
        const query = { evidence_id: evidenceId };

        if (filters.action) query.action = filters.action;
        if (filters.actor_id) query.actor_id = filters.actor_id;
        
        if (filters.startDate || filters.endDate) {
            query.timestamp = {};
            if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
            if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
        }

        const events = await CustodyEvent.find(query)
            .sort({ timestamp: 1 })
            .lean();

        return events;
    }

    /**
     * Verify the cryptographic integrity of a custody chain (Tamper Detection).
     */
    async verifyCustodyChain(evidenceId) {
        // Must retrieve ALL events in exact chronological order without filters
        const events = await CustodyEvent.find({ evidence_id: evidenceId })
            .sort({ timestamp: 1 })
            .lean();

        if (events.length === 0) {
            throw new NotFoundError('Custody events not found');
        }

        let previousHash = null;
        let isTampered = false;
        let tamperedEventIndex = -1;
        let reason = '';

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            // 1. Check link integrity
            if (i === 0 && event.previous_event_hash !== null) {
                isTampered = true;
                tamperedEventIndex = i;
                reason = 'Genesis event must have null previous_event_hash';
                break;
            }

            if (i > 0 && event.previous_event_hash !== previousHash) {
                isTampered = true;
                tamperedEventIndex = i;
                reason = `Broken chain link: expected ${previousHash}, found ${event.previous_event_hash}`;
                break;
            }

            // 2. Verify self hash
            const isSelfVerified = verifyEventHash({
                evidence_id: event.evidence_id,
                previous_event_hash: event.previous_event_hash,
                actor_id: event.actor_id,
                action_type: event.action,
                timestamp: new Date(event.timestamp).toISOString(),
                device_fingerprint: event.device_fingerprint,
                ip_address: event.ip_address,
            }, event.event_hash);

            if (!isSelfVerified) {
                isTampered = true;
                tamperedEventIndex = i;
                reason = `Data corruption or modification detected in event ${event.event_id}`;
                break;
            }

            previousHash = event.event_hash;
        }

        return {
            evidence_id: evidenceId,
            chain_length: events.length,
            is_intact: !isTampered,
            tamper_detected: isTampered,
            tampered_event_index: tamperedEventIndex,
            tamper_reason: reason,
        };
    }

    /**
     * Get all event hashes for a date range (used by ledger anchoring).
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Promise<string[]>}
     */
    async getEventHashesByDateRange(startDate, endDate) {
        const events = await CustodyEvent.find({
            timestamp: { $gte: startDate, $lt: endDate },
        })
            .select('event_hash')
            .sort({ timestamp: 1 })
            .lean();

        return events.map((e) => e.event_hash);
    }
}

export const custodyService = new CustodyService();
