/**
 * Verification Service — Industry-Grade File Integrity
 *
 * Implements the full forensic verification pipeline:
 *
 * UPLOAD FLOW:
 *   Buffer → Multi-hash → Chunk hashes → Merkle tree → Fuzzy hash
 *            → Trusted timestamp → Store ALL in DB
 *
 * VERIFY FLOW:
 *   Decrypt → Recalculate ALL hashes → Compare chunk-by-chunk
 *          → Rebuild Merkle tree → Verify timestamp → Return full report
 *
 * Methods (in order of strictness):
 *   1. basic       — SHA-256 only (fast)
 *   2. multi_hash  — SHA-256 + SHA-1 + MD5
 *   3. chunk       — 4 MB block-level comparison (locates tampered region)
 *   4. merkle      — Merkle tree root comparison (cryptographically strongest)
 *
 * References: EnCase, FTK, Autopsy, NIST SP 800-101r1
 */

import Evidence from '../models/Evidence.js';
import { decryptBuffer } from '../crypto/cryptoEngine.js';
import { getStorageDriver } from '../forensics/storageEngine.js';
import {
    generateMultiHash,
    verifyMultiHash,
    generateChunkHashes,
    verifyChunkHashes,
    buildMerkleTree,
    generateFuzzyHash,
    compareFuzzyHashes,
    generateTrustedTimestamp,
    verifyTrustedTimestamp,
    verifyHash,
    calculateEntropy,
    verifyFileSignature,
} from '../crypto/cryptoEngine.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';
import { custodyService } from './custodyService.js';

export class VerificationService {

    /**
     * FULL VERIFICATION PIPELINE
     * Runs all 4 methods sequentially and returns a unified report.
     *
     * @param {string} evidenceId
     * @param {Object} mcpContext
     * @returns {Promise<VerificationReport>}
     */
    async verifyEvidence(evidenceId, mcpContext) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId, status: 'active' });
        if (!evidence) throw new NotFoundError('Evidence');

        // ── Step 1: Read file from storage and decrypt ──────────
        let fileBuffer;
        try {
            const storage = getStorageDriver();
            const encryptedBuffer = await storage.read(evidence.storage_path);
            try {
                fileBuffer = decryptBuffer(
                    encryptedBuffer,
                    evidence.encryption_iv,
                    evidence.encryption_auth_tag
                );
            } catch (decryptErr) {
                // Fallback: use raw file (if not encrypted yet)
                fileBuffer = encryptedBuffer;
            }
        } catch (readErr) {
            logger.warn({ evidenceId, err: readErr.message }, 'Cannot read file for verification — hash-only mode');
            fileBuffer = null;
        }

        const report = {
            evidence_id: evidenceId,
            file_name: evidence.original_name,
            file_size: evidence.file_size,
            verification_time: new Date().toISOString(),
            verified_by: mcpContext?.user_id,
            methods_run: [],
            overall_result: 'pass',
            file_accessible: !!fileBuffer,
        };

        // ── Step 2: Multi-hash verification ─────────────────────
        const multiHashResult = await this._verifyMultiHash(evidence, fileBuffer);
        report.multi_hash = multiHashResult;
        report.methods_run.push('multi_hash');
        if (!multiHashResult.valid) report.overall_result = 'fail';

        // ── Step 3: Chunk-level verification ─────────────────────
        if (fileBuffer && evidence.chunk_hashes?.length > 0) {
            const chunkResult = this._verifyChunks(evidence, fileBuffer);
            report.chunk_verification = chunkResult;
            report.methods_run.push('chunk');
            if (!chunkResult.valid) report.overall_result = 'fail';
        }

        // ── Step 4: Merkle tree verification ─────────────────────
        if (fileBuffer && evidence.merkle_root && evidence.chunk_hashes?.length > 0) {
            const merkleResult = this._verifyMerkle(evidence, fileBuffer);
            report.merkle_verification = merkleResult;
            report.methods_run.push('merkle');
            if (!merkleResult.valid) report.overall_result = 'fail';
        }

        // ── Step 5: Trusted timestamp verification ──────────────
        if (evidence.trusted_timestamp?.signature) {
            const tsResult = verifyTrustedTimestamp(evidence.file_hash, evidence.trusted_timestamp);
            report.timestamp_verification = tsResult;
            report.methods_run.push('timestamp');
            if (!tsResult.valid) report.overall_result = 'fail';
        }

        // ── Step 6: Fuzzy hash comparison (similarity) ──────────
        if (fileBuffer && evidence.fuzzy_hash) {
            try {
                const currentFuzzy = generateFuzzyHash(fileBuffer);
                const similarity = compareFuzzyHashes(currentFuzzy.hash, evidence.fuzzy_hash);
                report.fuzzy_hash = {
                    stored: evidence.fuzzy_hash,
                    current: currentFuzzy.hash,
                    similarity_score: similarity,
                    suspicious: similarity < 80,
                };
                if (similarity < 50) report.overall_result = 'fail';
            } catch (err) {
                logger.warn({ err: err.message }, 'Fuzzy hash comparison failed');
            }
        }

        // ── Step 7: Deep Forensic Logics (Entropy & Signature) ──
        if (fileBuffer) {
            const entropy = calculateEntropy(fileBuffer);
            const extension = evidence.original_name.split('.').pop()?.toLowerCase();
            const signature = verifyFileSignature(fileBuffer, extension);
            
            // Forensic Industry Standards: 
            // - Encrypted/Compressed: > 7.5
            // - Executables/Packed: 5.0 - 7.0
            // - Plain Text: 3.5 - 5.0
            
            const compressedTypes = ['zip', 'rar', '7z', 'gz', 'jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'pptx'];
            const isCompressedType = compressedTypes.includes(extension);
            
            let entropyRisk = 'low';
            let entropyLabel = 'Normal Data Density';

            if (entropy > 7.5) {
                if (isCompressedType && signature.valid) {
                    entropyRisk = 'low';
                    entropyLabel = 'High Density (Expected for compressed format)';
                } else if (!signature.valid) {
                    entropyRisk = 'critical';
                    entropyLabel = 'Anomalous High Density (Potential Hidden Payload)';
                } else {
                    entropyRisk = 'high';
                    entropyLabel = 'Suspicious High Density (Potential Encryption)';
                }
            } else if (entropy > 7.0) {
                entropyRisk = 'medium';
                entropyLabel = 'Elevated Data Density';
            }

            // Absolute threshold for Raw Encryption (approaching 8.0)
            if (entropy > 7.9 && entropyRisk !== 'critical') {
                entropyRisk = 'high';
                entropyLabel = 'Extremely High Entropy (Possible Raw Encryption)';
            }

            report.forensic_analysis = {
                entropy: {
                    score: entropy,
                    risk: entropyRisk,
                    label: entropyLabel,
                },
                signature: {
                    valid: signature.valid,
                    mismatch: !signature.valid,
                    expected: signature.expected,
                    actual: signature.actual,
                }
            };

            if (!signature.valid) {
                report.overall_result = 'fail';
                report.error = report.error 
                    ? `${report.error} | Extension mismatch detected.` 
                    : 'Extension mismatch detected (Potential Extension Spoofing).';
            }
        }

        // If file is totally inaccessible, we must fail verification — we can't prove integrity.
        if (!fileBuffer) {
            report.overall_result = 'fail';
            report.error = 'File inaccessible from storage — cannot verify integrity.';
        }

        // ── Step 8: Update DB integrity status ───────────────────
        const passed = report.overall_result === 'pass';
        const historyEntry = {
            verified_at: new Date(),
            verified_by: mcpContext?.user_id,
            result: passed ? 'pass' : 'fail',
            method: 'multi_hash', // primary method
            tampered_chunks: report.chunk_verification?.tampered_chunks?.map(c => c.index) || [],
            details: {
                multi_hash_valid: multiHashResult.valid,
                chunk_valid: report.chunk_verification?.valid,
                merkle_valid: report.merkle_verification?.valid,
            },
        };

        await Evidence.findOneAndUpdate(
            { evidence_id: evidenceId },
            {
                integrity_status: passed ? 'verified' : 'tampered',
                last_verified_at: new Date(),
                last_verified_hash: evidence.file_hash,
                $push: { integrity_history: { $each: [historyEntry], $slice: -50 } }, // keep last 50
            }
        );

        // ── Step 9: Add forensic risk to AuditLog manually for accuracy ──
        if (!passed || report.forensic_analysis?.entropy?.risk === 'critical') {
            try {
                const AuditLog = (await import('../models/AuditLog.js')).default;
                const crypto = await import('node:crypto');
                
                await new AuditLog({
                    log_id: crypto.randomUUID(),
                    request_id: mcpContext?.request_id || crypto.randomBytes(8).toString('hex'),
                    user_id: mcpContext?.user_id || 'system',
                    user_role: mcpContext?.role || 'SYSTEM',
                    actor_name: mcpContext?.username || 'Forensic Engine',
                    method: 'POST',
                    endpoint: `/evidence/${evidenceId}/verify`,
                    action: 'RISK_DETECTED',
                    status_code: 200, // technically a success, but logically a risk
                    ip_address: mcpContext?.ip_address || '127.0.0.1',
                    request_body: { 
                        evidence_id: evidenceId,
                        risk_type: !passed ? 'TAMPERING' : 'FORENSIC_ANOMALY',
                        entropy: report.forensic_analysis?.entropy?.score,
                        label: report.forensic_analysis?.entropy?.label,
                        signature_match: report.forensic_analysis?.signature?.valid
                    },
                    timestamp: new Date()
                }).save();
            } catch (auditErr) {
                logger.warn({ err: auditErr.message }, 'Failed to log manual forensic risk');
            }
        }

        // ── Step 10: Add custody event ────────────────────────────
        try {
            await custodyService.createEvent({
                evidence_id: evidenceId,
                action: 'VERIFY_EVIDENCE',
                actor_id: mcpContext?.user_id,
                actor_name: mcpContext?.username,
                actor_role: mcpContext?.role,
                details: {
                    result: report.overall_result,
                    methods: report.methods_run,
                    tampered: !passed,
                    entropy: report.forensic_analysis?.entropy?.score,
                    spoofed: report.forensic_analysis?.signature?.mismatch,
                    risk_label: report.forensic_analysis?.entropy?.label
                },
            }, mcpContext);
        } catch (custodyErr) {
            logger.warn({ err: custodyErr.message }, 'Could not create custody event for verification');
        }

        logger.info({ evidenceId, result: report.overall_result, methods: report.methods_run }, 'Verification complete');
        return report;
    }

    // ── PRIVATE: Multi-hash engine ──────────────────────────────
    _verifyMultiHash(evidence, fileBuffer) {
        if (!fileBuffer) {
            // Cannot verify hash without the file buffer
            return {
                valid: false,
                mode: 'hash_only',
                sha256: { stored: evidence.file_hash, match: false, note: 'File not accessible' },
                sha1:   { stored: evidence.hash_sha1, match: false, note: 'File not accessible' },
                md5:    { stored: evidence.hash_md5, match: false, note: 'File not accessible' },
            };
        }

        const computed = generateMultiHash(fileBuffer);
        const sha256Ok = evidence.file_hash ? computed.sha256 === evidence.file_hash : true;
        const sha1Ok   = evidence.hash_sha1  ? computed.sha1   === evidence.hash_sha1  : null;
        const md5Ok    = evidence.hash_md5   ? computed.md5    === evidence.hash_md5   : null;

        // Must pass SHA-256. SHA-1 and MD5 are supplementary.
        const valid = sha256Ok && (sha1Ok !== false) && (md5Ok !== false);

        return {
            valid,
            mode: 'full_compute',
            sha256: { stored: evidence.file_hash, computed: computed.sha256, match: sha256Ok },
            sha1:   { stored: evidence.hash_sha1, computed: computed.sha1,   match: sha1Ok },
            md5:    { stored: evidence.hash_md5,  computed: computed.md5,    match: md5Ok },
            mismatches: [
                !sha256Ok && 'SHA-256',
                sha1Ok === false && 'SHA-1',
                md5Ok === false && 'MD5',
            ].filter(Boolean),
        };
    }

    // ── PRIVATE: Chunk-level verification ───────────────────────
    _verifyChunks(evidence, fileBuffer) {
        if (!evidence.chunk_hashes?.length) {
            return { valid: null, note: 'No chunk hashes stored — re-upload to enable' };
        }

        const result = verifyChunkHashes(
            fileBuffer,
            evidence.chunk_hashes,
            evidence.chunk_size_bytes
        );

        return {
            valid: result.valid,
            total_chunks: evidence.chunk_count,
            intact_chunks: result.intact_count,
            tampered_count: result.tampered_count,
            tampered_chunks: result.tampered_chunks,
            // Localize tampering to byte range
            tampered_byte_ranges: result.tampered_chunks.map(c => ({
                chunk_index: c.index,
                start_byte: c.offset,
                end_byte: c.offset + c.size,
                size_bytes: c.size,
            })),
        };
    }

    // ── PRIVATE: Merkle root verification ───────────────────────
    _verifyMerkle(evidence, fileBuffer) {
        if (!evidence.merkle_root) {
            return { valid: null, note: 'No Merkle root stored' };
        }

        // Recompute chunk hashes from current file
        const current = generateChunkHashes(fileBuffer, evidence.chunk_size_bytes);
        const currentLeaves = current.chunks.map(c => c.hash);
        const currentTree = buildMerkleTree(currentLeaves);

        const valid = currentTree.root === evidence.merkle_root;

        return {
            valid,
            stored_root:  evidence.merkle_root,
            computed_root: currentTree.root,
            leaf_count: currentTree.leaf_count,
        };
    }

    /**
     * Generate and store ALL integrity data for a newly uploaded buffer.
     * Called from evidenceService.uploadEvidence().
     *
     * @param {Buffer} buffer - raw file buffer (pre-encryption)
     * @returns {IntegrityPackage}
     */
    static generateIntegrityPackage(buffer) {
        // Multi-hash
        const hashes = generateMultiHash(buffer);

        // Chunk hashing
        const chunkData = generateChunkHashes(buffer);

        // Merkle tree
        const leafHashes = chunkData.chunks.map(c => c.hash);
        const merkle = buildMerkleTree(leafHashes);

        // Fuzzy hash
        const fuzzy = generateFuzzyHash(buffer);

        // Trusted timestamp (using SHA-256 as the signed hash)
        const trustedTs = generateTrustedTimestamp(hashes.sha256);

        return {
            // Primary hash (existing field)
            file_hash:    hashes.sha256,

            // Multi-hash
            hash_sha1:    hashes.sha1,
            hash_md5:     hashes.md5,

            // Chunks
            chunk_hashes:     chunkData.chunks,
            chunk_size_bytes: chunkData.chunk_size_bytes,
            chunk_count:      chunkData.chunk_count,

            // Merkle
            merkle_root: merkle.root,

            // Fuzzy
            fuzzy_hash: fuzzy.hash,

            // Trusted timestamp
            trusted_timestamp: trustedTs,
        };
    }
}

export const verificationService = new VerificationService();
