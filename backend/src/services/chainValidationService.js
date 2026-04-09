/**
 * Chain Validation Service
 *
 * Validates the integrity of the custody event hash chain.
 * Detects any tampering by recalculating and comparing event hashes.
 */

import CustodyEvent from '../models/CustodyEvent.js';
import { generateEventHash, verifyHash } from '../crypto/cryptoEngine.js';
import { logger } from '../utils/logger.js';

export class ChainValidationService {
    /**
     * Validate the entire custody chain for a piece of evidence.
     *
     * Algorithm:
     *   1. Retrieve all custody events sorted by timestamp
     *   2. For each event, recalculate the event hash
     *   3. Compare with stored hash
     *   4. Verify previous_event_hash linkage
     *   5. Report any inconsistencies
     *
     * @param {string} evidenceId
     * @returns {Promise<Object>} validation result
     */
    async validateChain(evidenceId) {
        const events = await CustodyEvent.find({ evidence_id: evidenceId })
            .sort({ timestamp: 1 })
            .lean();

        if (events.length === 0) {
            return {
                evidence_id: evidenceId,
                chain_valid: false,
                chain_length: 0,
                tampering_detected: false,
                broken_event_id: null,
                message: 'No custody events found for this evidence',
                validated_at: new Date().toISOString(),
            };
        }

        let chainValid = true;
        let tamperingDetected = false;
        let brokenEventId = null;
        let brokenEventIndex = null;
        const errors = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const expectedPrevHash = i === 0 ? null : events[i - 1].event_hash;

            // Verify previous event hash linkage
            if (event.previous_event_hash !== expectedPrevHash) {
                chainValid = false;
                tamperingDetected = true;
                brokenEventId = event.event_id;
                brokenEventIndex = i;
                errors.push({
                    event_id: event.event_id,
                    event_index: i,
                    type: 'BROKEN_LINK',
                    message: `Previous hash mismatch at event ${i}. Expected: ${expectedPrevHash}, Found: ${event.previous_event_hash}`,
                });
                break;
            }

            // Recalculate event hash
            const recalculatedHash = generateEventHash({
                evidence_id: event.evidence_id,
                previous_event_hash: event.previous_event_hash,
                actor_id: event.actor_id,
                action_type: event.action,
                timestamp: event.timestamp.toISOString(),
                device_fingerprint: event.device_fingerprint,
                ip_address: event.ip_address,
            });

            // Compare with stored hash
            try {
                const hashMatch = verifyHash(recalculatedHash, event.event_hash);
                if (!hashMatch) {
                    chainValid = false;
                    tamperingDetected = true;
                    brokenEventId = event.event_id;
                    brokenEventIndex = i;
                    errors.push({
                        event_id: event.event_id,
                        event_index: i,
                        type: 'HASH_MISMATCH',
                        message: `Hash mismatch at event ${i}. Stored: ${event.event_hash}, Calculated: ${recalculatedHash}`,
                    });
                    break;
                }
            } catch {
                chainValid = false;
                tamperingDetected = true;
                brokenEventId = event.event_id;
                brokenEventIndex = i;
                errors.push({
                    event_id: event.event_id,
                    event_index: i,
                    type: 'HASH_VERIFICATION_ERROR',
                    message: `Hash verification error at event ${i}`,
                });
                break;
            }
        }

        const result = {
            evidence_id: evidenceId,
            chain_valid: chainValid,
            chain_length: events.length,
            tampering_detected: tamperingDetected,
            broken_event_id: brokenEventId,
            broken_event_index: brokenEventIndex,
            errors,
            first_event: events[0] ? {
                event_id: events[0].event_id,
                action: events[0].action,
                timestamp: events[0].timestamp,
            } : null,
            last_event: events[events.length - 1] ? {
                event_id: events[events.length - 1].event_id,
                action: events[events.length - 1].action,
                timestamp: events[events.length - 1].timestamp,
            } : null,
            validated_at: new Date().toISOString(),
        };

        if (tamperingDetected) {
            logger.warn({ evidenceId, brokenEventId, errors }, 'TAMPERING DETECTED in custody chain');
        } else {
            logger.debug({ evidenceId, chainLength: events.length }, 'Chain validation passed');
        }

        return result;
    }
}

export const chainValidationService = new ChainValidationService();
