/**
 * Evidence Timeline Service
 *
 * Generates chronological timeline of all events
 * related to a piece of evidence.
 */

import CustodyEvent from '../models/CustodyEvent.js';
import Evidence from '../models/Evidence.js';
import { NotFoundError } from '../utils/errors.js';
import { cacheGet, cacheSet } from '../core/redis.js';

const ACTION_LABELS = {
    CREATE_EVIDENCE: 'Evidence Created',
    VIEW_EVIDENCE: 'Evidence Accessed',
    TRANSFER_CUSTODY: 'Custody Transferred',
    VERIFY_EVIDENCE: 'Evidence Verified',
    EXPORT_EVIDENCE: 'Evidence Exported',
    DOWNLOAD_EVIDENCE: 'Evidence Downloaded',
    SIGN_EVIDENCE: 'Evidence Digitally Signed',
};

const ACTION_ICONS = {
    CREATE_EVIDENCE: 'upload',
    VIEW_EVIDENCE: 'eye',
    TRANSFER_CUSTODY: 'transfer',
    VERIFY_EVIDENCE: 'shield-check',
    EXPORT_EVIDENCE: 'download',
    DOWNLOAD_EVIDENCE: 'download',
    SIGN_EVIDENCE: 'pencil',
};

export class TimelineService {
    /**
     * Get the full timeline for a piece of evidence.
     * @param {string} evidenceId
     * @returns {Promise<Object>}
     */
    async getTimeline(evidenceId) {
        const cacheKey = `timeline:${evidenceId}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        // Verify evidence exists
        const evidence = await Evidence.findOne({ evidence_id: evidenceId })
            .select('evidence_id case_id original_name file_hash created_at')
            .lean();

        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        const events = await CustodyEvent.find({ evidence_id: evidenceId })
            .sort({ timestamp: 1 })
            .lean();

        const timeline = events.map((event, index) => ({
            index,
            event_id: event.event_id,
            action: event.action,
            label: ACTION_LABELS[event.action] || event.action,
            icon: ACTION_ICONS[event.action] || 'circle',
            actor: {
                id: event.actor_id,
                name: event.actor_name,
                role: event.actor_role,
            },
            details: event.details,
            ip_address: event.ip_address,
            device_fingerprint: event.device_fingerprint,
            geo_location: event.geo_location,
            event_hash: event.event_hash,
            previous_event_hash: event.previous_event_hash,
            timestamp: event.timestamp,
        }));

        const result = {
            evidence_id: evidenceId,
            case_id: evidence.case_id,
            file_name: evidence.original_name,
            file_hash: evidence.file_hash,
            total_events: timeline.length,
            timeline,
            generated_at: new Date().toISOString(),
        };

        await cacheSet(cacheKey, result, 30); // Short TTL since timeline changes
        return result;
    }

    /**
     * Get a summary of evidence activity (counts by action type).
     */
    async getActivitySummary(evidenceId) {
        const events = await CustodyEvent.find({ evidence_id: evidenceId }).lean();

        const summary = {};
        for (const event of events) {
            summary[event.action] = (summary[event.action] || 0) + 1;
        }

        return {
            evidence_id: evidenceId,
            total_events: events.length,
            activity_breakdown: summary,
            first_event: events.length > 0 ? events[0].timestamp : null,
            last_event: events.length > 0 ? events[events.length - 1].timestamp : null,
        };
    }
}

export const timelineService = new TimelineService();
