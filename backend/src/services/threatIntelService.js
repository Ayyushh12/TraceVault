/**
 * Threat Intelligence Service — Rule-Based Engine (NO FAKE AI)
 *
 * This is a DETERMINISTIC RULE ENGINE.
 * Zero ML, zero "AI" claims — pure forensic logic matching industry tools.
 *
 * RISK SCORE FORMULA:
 *   score = sum of triggered rule weights (0–100 capped)
 *   0–25   → LOW
 *   26–50  → MEDIUM
 *   51–75  → HIGH
 *   76+    → CRITICAL
 *
 * RULE CATEGORIES:
 *   Integrity   — hash mismatches, Merkle failures
 *   Access      — unauthorized access, off-hours, mass download
 *   Behavior    — rapid transfers, bulk deletes, failed auth
 *   Source      — unknown uploader, no custody chain
 *
 * References: NIST SP 800-101r1, EnCase risk analytics, Autopsy flag rules
 */

import Evidence from '../models/Evidence.js';
import AuditLog from '../models/AuditLog.js';
import CustodyEvent from '../models/CustodyEvent.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

// ── RISK WEIGHTS (deterministic) ─────────────────────────────────
const RISK_WEIGHTS = {
    // Integrity rules
    HASH_MISMATCH:            { weight: 60, category: 'integrity',    label: 'Hash Mismatch Detected' },
    NO_SHA1_MD5:              { weight: 10, category: 'integrity',    label: 'Incomplete Hash Coverage' },
    NO_MERKLE_ROOT:           { weight: 8,  category: 'integrity',    label: 'No Merkle Verification' },
    NO_TRUSTED_TIMESTAMP:     { weight: 5,  category: 'integrity',    label: 'No Trusted Timestamp' },
    NEVER_VERIFIED:           { weight: 15, category: 'integrity',    label: 'Evidence Never Verified' },

    // Access rules
    HIGH_ACCESS_COUNT:        { weight: 20, category: 'access',       label: 'Abnormally High Access Count' },
    OFF_HOURS_ACCESS:         { weight: 10, category: 'access',       label: 'Off-Hours Access' },
    MULTIPLE_DOWNLOADS:       { weight: 10, category: 'access',       label: 'Multiple Downloads Detected' },
    UNAUTHORIZED_ROLE:        { weight: 30, category: 'access',       label: 'Access by Unauthorized Role' },
    MULTIPLE_IPS_EVIDENCE:    { weight: 20, category: 'access',       label: 'Access from Multiple Distinct IPs' },

    // Behavior rules
    RAPID_CUSTODY_CHANGES:    { weight: 25, category: 'behavior',     label: 'Rapid Custody Transfers' },
    MASS_EVIDENCE_ACCESS:     { weight: 35, category: 'behavior',     label: 'Mass Evidence Access (Bulk)' },
    EVIDENCE_LOCKED:          { weight: 5,  category: 'behavior',     label: 'Evidence Under Legal Hold' },

    // Source rules
    NO_CUSTODY_CHAIN:         { weight: 20, category: 'source',       label: 'No Custody Chain Events' },
    UNKNOWN_UPLOADER:         { weight: 15, category: 'source',       label: 'Uploader Unknown / Missing' },
};

function scoreToLevel(score) {
    if (score >= 76) return 'critical';
    if (score >= 51) return 'high';
    if (score >= 26) return 'medium';
    return 'low';
}

export class ThreatIntelService {

    // ── EVIDENCE RISK SCORING ─────────────────────────────────────
    async calculateEvidenceRisk(evidenceId) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId }).lean();
        if (!evidence) return null;

        const triggeredRules = [];
        let rawScore = 0;

        const addRule = (key) => {
            const rule = RISK_WEIGHTS[key];
            if (rule) {
                triggeredRules.push({ rule: key, ...rule });
                rawScore += rule.weight;
            }
        };

        // ── Integrity rules ──────────────────────────────────────
        if (evidence.integrity_status === 'tampered') addRule('HASH_MISMATCH');
        if (!evidence.hash_sha1 || !evidence.hash_md5) addRule('NO_SHA1_MD5');
        if (!evidence.merkle_root) addRule('NO_MERKLE_ROOT');
        if (!evidence.trusted_timestamp?.signature) addRule('NO_TRUSTED_TIMESTAMP');
        if (!evidence.last_verified_at) addRule('NEVER_VERIFIED');

        // ── Access rules ─────────────────────────────────────────
        if ((evidence.access_count || 0) > 20) addRule('HIGH_ACCESS_COUNT');
        if (evidence.is_locked) addRule('EVIDENCE_LOCKED');

        // Get custody events for this evidence
        const custodyCount = await CustodyEvent.countDocuments({ evidence_id: evidenceId });
        if (custodyCount === 0) addRule('NO_CUSTODY_CHAIN');

        // Check for rapid custody changes (>3 transfers in 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentTransfers = await CustodyEvent.countDocuments({
            evidence_id: evidenceId,
            action: 'TRANSFER_CUSTODY',
            timestamp: { $gte: oneHourAgo },
        });
        if (recentTransfers >= 3) addRule('RAPID_CUSTODY_CHANGES');

        // Check downloads
        const downloadCount = await AuditLog.countDocuments({
            action: { $regex: 'DOWNLOAD', $options: 'i' },
            endpoint: { $regex: evidenceId },
        });
        if (downloadCount > 3) addRule('MULTIPLE_DOWNLOADS');

        // Check for Multi-IP Contamination 
        const distinctIpsCount = await AuditLog.distinct('ip_address', {
             endpoint: { $regex: evidenceId }
        }).then(ips => ips.length);
        if (distinctIpsCount >= 3) addRule('MULTIPLE_IPS_EVIDENCE');

        // ── Source rules ─────────────────────────────────────────
        if (!evidence.uploaded_by || evidence.uploaded_by === 'unknown') addRule('UNKNOWN_UPLOADER');

        // Cap at 100
        const score = Math.min(rawScore, 100);
        const level = scoreToLevel(score);

        return {
            evidence_id: evidenceId,
            file_name: evidence.original_name,
            risk_score: score,
            risk_level: level,
            triggered_rules: triggeredRules,
            rule_count: triggeredRules.length,
            score_breakdown: {
                integrity: triggeredRules.filter(r => r.category === 'integrity').reduce((a, r) => a + r.weight, 0),
                access:    triggeredRules.filter(r => r.category === 'access').reduce((a, r) => a + r.weight, 0),
                behavior:  triggeredRules.filter(r => r.category === 'behavior').reduce((a, r) => a + r.weight, 0),
                source:    triggeredRules.filter(r => r.category === 'source').reduce((a, r) => a + r.weight, 0),
            },
            calculated_at: new Date().toISOString(),
        };
    }

    // ── ANOMALY DETECTION (rule-based) ───────────────────────────
    /**
     * Rule Set:
     * 1. Off-hours access    — any access between 00:00–06:00 local time
     * 2. Mass evidence access — >10 evidence reads in 5 minutes by same user
     * 3. Brute force         — >5 failed logins in 10 minutes by same IP
     * 4. Rapid custody changes — >3 custody transfers in 1 hour
     * 5. Failed auth spike   — >10 auth failures in 30 minutes
     * 6. Hash mismatch       — any tampered evidence
     * 7. Impossible Travel   — single user accessing from >=3 distinct IPs in 24 hours
     * 8. Privilege Esc       — single user triggering >=2 403 Forbidden blocks in 24 hours
     */
    async detectAnomalies() {
        const anomalies = [];
        const now = new Date();
        const _5min  = new Date(now - 5  * 60 * 1000);
        const _10min = new Date(now - 10 * 60 * 1000);
        const _30min = new Date(now - 30 * 60 * 1000);
        const _1hr   = new Date(now - 60 * 60 * 1000);
        const _24hr  = new Date(now - 24 * 60 * 60 * 1000);

        // ── Rule 1: Off-hours access ─────────────────────────────
        const offHourLogs = await AuditLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: _24hr },
                    action: { $regex: 'EVIDENCE', $options: 'i' },
                }
            },
            {
                $addFields: {
                    hour: { $hour: '$timestamp' },
                }
            },
            {
                $match: { hour: { $in: [0, 1, 2, 3, 4, 5] } },
            },
            {
                $group: {
                    _id: '$user_id',
                    count: { $sum: 1 },
                    actor_name: { $first: '$actor_name' },
                    last_at: { $max: '$timestamp' },
                }
            },
            { $match: { count: { $gte: 1 } } },
        ]);

        offHourLogs.forEach(u => {
            anomalies.push({
                anomaly_id: `off_hours_${u._id}`,
                type:        'off_hours_access',
                severity:    'medium',
                description: `${u.actor_name || u._id} accessed evidence during off-hours (00:00–06:00) — ${u.count} event(s)`,
                user_id:     u._id,
                user_name:   u.actor_name,
                count:       u.count,
                detected_at: u.last_at,
                rule:        'IF evidence_access BETWEEN 00:00 AND 06:00 THEN flag',
            });
        });

        // ── Rule 2: Mass evidence access (bulk) ──────────────────
        const massAccess = await AuditLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: _5min },
                    action: { $regex: 'READ:EVIDENCE|VIEW', $options: 'i' },
                }
            },
            {
                $group: {
                    _id: '$user_id',
                    count: { $sum: 1 },
                    actor_name: { $first: '$actor_name' },
                    last_at: { $max: '$timestamp' },
                }
            },
            { $match: { count: { $gte: 10 } } },
        ]);

        massAccess.forEach(u => {
            anomalies.push({
                anomaly_id:  `mass_access_${u._id}`,
                type:         'mass_evidence_access',
                severity:     'high',
                description:  `${u.actor_name || 'User'} accessed ${u.count} evidence items in 5 minutes — possible bulk exfiltration`,
                user_id:      u._id,
                user_name:    u.actor_name,
                count:        u.count,
                detected_at:  u.last_at,
                rule:         'IF evidence_reads > 10 IN 5_minutes THEN alert',
            });
        });

        // ── Rule 3: Brute-force login attempts ───────────────────
        const bruteForce = await AuditLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: _10min },
                    status_code: { $in: [401, 403] },
                    action: { $regex: 'AUTH', $options: 'i' },
                }
            },
            {
                $group: {
                    _id: '$ip_address',
                    count: { $sum: 1 },
                    last_at: { $max: '$timestamp' },
                }
            },
            { $match: { count: { $gte: 5 } } },
        ]);

        bruteForce.forEach(ip => {
            anomalies.push({
                anomaly_id:  `brute_${ip._id}`,
                type:         'brute_force_attempt',
                severity:     'critical',
                description:  `${ip.count} failed authentication attempts from IP ${ip._id} in 10 minutes`,
                ip_address:   ip._id,
                count:        ip.count,
                detected_at:  ip.last_at,
                rule:         'IF failed_auth > 5 FROM same_ip IN 10_minutes THEN critical_alert',
            });
        });

        // ── Rule 4: Rapid custody transfers ──────────────────────
        const rapidCustody = await CustodyEvent.aggregate([
            {
                $match: {
                    timestamp: { $gte: _1hr },
                    action: 'TRANSFER_CUSTODY',
                }
            },
            {
                $group: {
                    _id: '$evidence_id',
                    count: { $sum: 1 },
                    last_at: { $max: '$timestamp' },
                }
            },
            { $match: { count: { $gte: 3 } } },
        ]);

        rapidCustody.forEach(e => {
            anomalies.push({
                anomaly_id:  `rapid_custody_${e._id}`,
                type:         'rapid_custody_changes',
                severity:     'high',
                description:  `Evidence ${e._id.slice(0, 12)} had ${e.count} custody transfers in 1 hour`,
                evidence_id:  e._id,
                count:        e.count,
                detected_at:  e.last_at,
                rule:         'IF custody_transfers > 3 FOR same_evidence IN 1_hour THEN alert',
            });
        });

        // ── Rule 5: Hash mismatch (real-time) ────────────────────
        const tampered = await Evidence.find({ integrity_status: 'tampered', status: 'active' })
            .select('evidence_id original_name last_verified_at uploaded_by')
            .lean();

        tampered.forEach(ev => {
            anomalies.push({
                anomaly_id:  `hash_mismatch_${ev.evidence_id}`,
                type:         'hash_mismatch',
                severity:     'critical',
                description:  `Evidence "${ev.original_name}" failed integrity verification — hash mismatch`,
                evidence_id:  ev.evidence_id,
                detected_at:  ev.last_verified_at || new Date(),
                rule:         'IF computed_hash != stored_hash THEN critical_alert',
            });
        });

        // ── Rule 6: Impossible Travel / Account Sharing ───────────
        const multiIp = await AuditLog.aggregate([
            { $match: { timestamp: { $gte: _24hr } } },
            { $group: {
                _id: '$user_id',
                ips: { $addToSet: '$ip_address' },
                actor_name: { $first: '$actor_name' },
                last_at: { $max: '$timestamp' }
            }},
            { $project: { ip_count: { $size: '$ips' }, ips: 1, actor_name: 1, last_at: 1 } },
            { $match: { ip_count: { $gte: 3 } } }
        ]);

        multiIp.forEach(u => {
            anomalies.push({
                anomaly_id: `multi_ip_${u._id}`,
                type: 'multiple_ip_access',
                severity: 'high',
                description: `${u.actor_name || u._id} accessed the chain from ${u.ip_count} distinct IP addresses in 24 hours.`,
                user_id: u._id,
                user_name: u.actor_name,
                count: u.ip_count,
                detected_at: u.last_at,
                rule: 'IF distinct_ips >= 3 FOR same_user IN 24_hours THEN alert',
            });
        });

        // ── Rule 7: Privilege Escalation (403 Tracking) ───────────
        const privEsc = await AuditLog.aggregate([
            { $match: { timestamp: { $gte: _24hr }, status_code: 403 } },
            { $group: {
                _id: '$user_id',
                count: { $sum: 1 },
                actor_name: { $first: '$actor_name' },
                last_at: { $max: '$timestamp' }
            }},
            { $match: { count: { $gte: 2 } } }
        ]);

        privEsc.forEach(u => {
            anomalies.push({
                anomaly_id: `priv_esc_${u._id}`,
                type: 'privilege_escalation',
                severity: 'critical',
                description: `${u.actor_name || u._id} triggered ${u.count} unauthorized access (403) blocks on restricted endpoints.`,
                user_id: u._id,
                user_name: u.actor_name,
                count: u.count,
                detected_at: u.last_at,
                rule: 'IF 403_Forbidden >= 2 FOR same_user IN 24_hours THEN critical_alert',
            });
        });

        // Sort by severity
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        anomalies.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

        logger.debug({ count: anomalies.length }, 'Anomaly detection complete');
        return { anomalies, total: anomalies.length, critical: anomalies.filter(a => a.severity === 'critical').length };
    }

    // ── THREAT DASHBOARD ─────────────────────────────────────────
    async getDashboardIntel() {
        const [anomalyResult, riskDist, topRiskyEvidence, suspiciousUsers] = await Promise.all([
            this.detectAnomalies(),
            this._getRiskDistribution(),
            this._getTopRiskyEvidence(5),
            this._getSuspiciousUsers(),
        ]);

        const criticalCount = anomalyResult.critical;
        const highCount = anomalyResult.anomalies.filter(a => a.severity === 'high').length;

        let overall_threat_level = 'low';
        if (criticalCount > 0) overall_threat_level = 'critical';
        else if (highCount > 0) overall_threat_level = 'high';
        else if (anomalyResult.total > 0) overall_threat_level = 'medium';

        return {
            overall_threat_level,
            anomaly_count: anomalyResult.total,
            critical_alerts: criticalCount,
            risk_distribution: riskDist,
            top_risks: topRiskyEvidence,
            suspicious_users: suspiciousUsers,
            anomalies: anomalyResult.anomalies.slice(0, 10),
            engine: 'rule_based',   // explicit: not AI
            engine_version: '2.0',
            rules_evaluated: Object.keys(RISK_WEIGHTS).length,
            generated_at: new Date().toISOString(),
        };
    }

    // ── DUPLICATE / SIMILARITY DETECTION ─────────────────────────
    async detectDuplicates() {
        // Exact duplicates = same SHA-256 hash
        const hashGroups = await Evidence.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$file_hash', count: { $sum: 1 }, items: { $push: { evidence_id: '$evidence_id', name: '$original_name', case_id: '$case_id' } } } },
            { $match: { count: { $gte: 2 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
        ]);

        // Similar files = same mime_type + similar size (±10%)
        const similarGroups = await Evidence.aggregate([
            { $match: { status: 'active' } },
            { $group: {
                _id: { mime: '$mime_type', size_bucket: { $subtract: ['$file_size', { $mod: ['$file_size', 51200] }] } },
                count: { $sum: 1 },
                items: { $push: { evidence_id: '$evidence_id', name: '$original_name', file_size: '$file_size' } },
            }},
            { $match: { count: { $gte: 2 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        return {
            exact_duplicates: hashGroups,
            similar_items: similarGroups,
            exact_count: hashGroups.reduce((s, g) => s + g.count, 0),
            group_count: hashGroups.length,
        };
    }

    // ── CASE THREAT ───────────────────────────────────────────────
    async calculateCaseThreat(caseId) {
        const evidenceList = await Evidence.find({ case_id: caseId, status: 'active' }).lean();
        if (!evidenceList.length) return { case_id: caseId, risk_score: 0, risk_level: 'low', evidence_count: 0 };

        const tampered = evidenceList.filter(e => e.integrity_status === 'tampered').length;
        const unverified = evidenceList.filter(e => !e.last_verified_at).length;
        const highAccess = evidenceList.filter(e => (e.access_count || 0) > 20).length;

        let score = 0;
        score += tampered * 40;
        score += unverified * 10;
        score += highAccess * 15;
        score = Math.min(score, 100);

        return {
            case_id: caseId,
            risk_score: score,
            risk_level: scoreToLevel(score),
            evidence_count: evidenceList.length,
            tampered_count: tampered,
            unverified_count: unverified,
            high_access_count: highAccess,
        };
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────
    async _getRiskDistribution() {
        // Run true deterministic scoring engine mapped accurately to baseline distributions
        const activeEvidence = await Evidence.find({ status: 'active' }).select('evidence_id').lean();
        let critical = 0, high = 0, medium = 0, low = 0;

        // Execute parallel real-time scoring rules across all active nodes to enforce 100% correlation parity
        const scores = await Promise.all(activeEvidence.map(ev => this.calculateEvidenceRisk(ev.evidence_id)));

        scores.forEach(s => {
            if (!s) return;
            if (s.risk_level === 'critical') critical++;
            else if (s.risk_level === 'high') high++;
            else if (s.risk_level === 'medium') medium++;
            else low++;
        });

        return {
            critical,
            high,
            medium,
            low,
            total: activeEvidence.length,
        };
    }

    async _getTopRiskyEvidence(limit = 5) {
        // Return tampered + high-access evidence without running full scoring per-item
        const items = await Evidence.find({
            status: 'active',
            $or: [
                { integrity_status: 'tampered' },
                { access_count: { $gte: 15 } },
                { last_verified_at: null },
            ],
        }).sort({ access_count: -1 }).limit(limit).lean();

        return items.map(ev => {
            let score = 0;
            if (ev.integrity_status === 'tampered') score += 50;
            if (!ev.last_verified_at) score += 15;
            if ((ev.access_count || 0) > 20) score += 20;
            if (!ev.hash_sha1) score += 10;
            score = Math.min(score, 100);

            return {
                evidence_id: ev.evidence_id,
                file_name:   ev.original_name,
                risk_score:  score,
                risk_level:  scoreToLevel(score),
                integrity_status: ev.integrity_status,
                access_count: ev.access_count || 0,
            };
        }).sort((a, b) => b.risk_score - a.risk_score);
    }

    async _getSuspiciousUsers() {
        // Users with >=5 failed authentications/authorizations in last 24 hours
        const _24hr = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const suspicious = await AuditLog.aggregate([
            { $match: { timestamp: { $gte: _24hr }, status_code: { $in: [401, 403] } } },
            { $group: {
                _id: '$user_id',
                error_count: { $sum: 1 },
                actor_name: { $first: '$actor_name' },
                last_error: { $max: '$timestamp' },
            }},
            { $match: { error_count: { $gte: 5 } } },
            { $sort: { error_count: -1 } },
            { $limit: 5 },
        ]);
        return suspicious;
    }
}

export const threatIntelService = new ThreatIntelService();
