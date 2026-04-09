/**
 * Evidence Service
 *
 * Handles the core evidence pipeline:
 *   Upload → Hash → Encrypt → Store → Record → Custody Event
 */

import crypto from 'node:crypto';
import Evidence from '../models/Evidence.js';
import EvidenceVersion from '../models/EvidenceVersion.js';
import { getStorageDriver } from '../forensics/storageEngine.js';
import {
    generateBufferHash,
    encryptBuffer,
    decryptBuffer,
    signData,
    verifySignature,
} from '../crypto/cryptoEngine.js';
import { VerificationService } from './verificationService.js';
import { custodyService } from './custodyService.js';
import { caseService } from './caseService.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { validateFileUpload, sanitizeFilename } from '../middleware/security.js';
import { cacheGet, cacheSet, cacheDelete } from '../core/redis.js';
import { notificationService } from './notificationService.js';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

export class EvidenceService {
    /**
     * Upload and store evidence.
     * @param {Object} fileData - { buffer, filename, mimetype }
     * @param {Object} metadata - { case_id, description, tags }
     * @param {Object} mcpContext
     * @returns {Promise<Object>}
     */
    async uploadEvidence(fileData, metadata, mcpContext) {
        const { buffer, filename, mimetype } = fileData;

        // Validate file
        validateFileUpload(filename, mimetype, buffer.length);

        // Verify case exists and user has access
        await caseService.getCaseById(metadata.case_id, mcpContext);

        // ─── STAGE 1: Generate full integrity package BEFORE encryption ──
        // This is the ORIGINAL unmodified file — any later change will fail verification
        logger.info({ filename, size: buffer.length }, 'Generating integrity package…');
        const integrity = VerificationService.generateIntegrityPackage(buffer);
        logger.info({
            sha256: integrity.file_hash.slice(0, 16) + '…',
            chunks: integrity.chunk_count,
            merkle: integrity.merkle_root?.slice(0, 16) + '…',
        }, 'Integrity package ready');

        // ─── STAGE 2: Encrypt file (AES-256-GCM) ─────────────────────────
        const { encrypted, iv, authTag } = encryptBuffer(buffer);

        // ─── STAGE 3: Persist to storage ─────────────────────────────────
        const storage = getStorageDriver();
        const safeFilename = sanitizeFilename(filename);
        const storagePath = await storage.store(safeFilename, encrypted, metadata.case_id);

        // ─── STAGE 4: Create Evidence record with ALL integrity fields ────
        const evidenceId = crypto.randomUUID();
        const evidence = new Evidence({
            evidence_id:   evidenceId,
            case_id:       metadata.case_id,
            file_name:     safeFilename,
            original_name: filename,
            mime_type:     mimetype,
            file_size:     buffer.length,

            // Level 1 — SHA-256
            file_hash:    integrity.file_hash,

            // Level 2 — Multi-hash
            hash_sha1:    integrity.hash_sha1,
            hash_md5:     integrity.hash_md5,

            // Level 2 — Trusted timestamp
            trusted_timestamp: integrity.trusted_timestamp,

            // Level 3 — Chunk hashes
            chunk_hashes:     integrity.chunk_hashes,
            chunk_size_bytes: integrity.chunk_size_bytes,
            chunk_count:      integrity.chunk_count,

            // Level 3 — Merkle root
            merkle_root: integrity.merkle_root,

            // Level 3 — Fuzzy hash
            fuzzy_hash: integrity.fuzzy_hash,

            // Encryption
            storage_path:          storagePath,
            encryption_iv:         iv,
            encryption_auth_tag:   authTag || null,
            encryption_algorithm:  config.encryption.algorithm,
            storage_driver:        config.storage.driver,

            // Metadata
            description:       metadata.description || '',
            tags:              metadata.tags || [],
            category:          metadata.category || 'other',
            uploaded_by:       mcpContext.user_id,
            uploaded_by_name:  mcpContext.username || mcpContext.user_id,
            current_custodian: mcpContext.user_id,

            // Initial integrity status — set to verified since we just computed
            integrity_status: 'verified',
            last_verified_at: new Date(),
        });

        await evidence.save();

        // ─── STAGE 5: Genesis custody event ──────────────────────────────
        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'CREATE_EVIDENCE',
            actor_id:   mcpContext.user_id,
            actor_name: mcpContext.username || mcpContext.user_id,
            actor_role: mcpContext.role,
            details: {
                file_name:    filename,
                file_size:    buffer.length,
                mime_type:    mimetype,
                // Include all hash digests in the genesis event for court-admissible proof
                hashes: {
                    sha256: integrity.file_hash,
                    sha1:   integrity.hash_sha1,
                    md5:    integrity.hash_md5,
                },
                merkle_root:  integrity.merkle_root,
                chunk_count:  integrity.chunk_count,
                timestamp_nonce: integrity.trusted_timestamp?.nonce,
            },
        }, mcpContext);

        // ─── STAGE 6: Increment case evidence counter ─────────────────────
        await caseService.incrementEvidenceCount(metadata.case_id);

        logger.info({
            evidenceId,
            caseId: metadata.case_id,
            sha256: integrity.file_hash.slice(0, 16),
            chunks: integrity.chunk_count,
        }, 'Evidence uploaded with full integrity package');

        // Trigger Notification
        await notificationService.createNotification(
            mcpContext.user_id,
            'EVIDENCE_UPLOADED',
            'New Evidence Uploaded',
            `File ${filename} was uploaded securely to case ${metadata.case_id}.`,
            { evidence_id: evidenceId, case_id: metadata.case_id },
            `/evidence/${evidenceId}`
        );

        return {
            evidence_id:  evidenceId,
            case_id:      metadata.case_id,
            file_name:    filename,
            file_hash:    integrity.file_hash,
            hash_sha1:    integrity.hash_sha1,
            hash_md5:     integrity.hash_md5,
            merkle_root:  integrity.merkle_root,
            chunk_count:  integrity.chunk_count,
            file_size:    buffer.length,
            mime_type:    mimetype,
            uploaded_by:  mcpContext.user_id,
            created_at:   evidence.created_at,
            integrity_status: 'verified',
        };
    }

    /**
     * List all evidence, optionally filtered by case.
     */
    async listEvidence(mcpContext, caseId = null, page = 1, limit = 20) {
        const query = { status: 'active' };
        if (caseId) query.case_id = caseId;

        const skip = (page - 1) * limit;
        const [evidences, total] = await Promise.all([
            Evidence.find(query)
                .select('-storage_path -encryption_iv')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Evidence.countDocuments(query),
        ]);

        return {
            evidences,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get evidence by ID. Records a VIEW_EVIDENCE custody event.
     */
    async getEvidenceById(evidenceId, mcpContext, recordAccess = true) {
        const evidence = await Evidence.findOne({
            evidence_id: evidenceId,
            status: 'active',
        })
            .select('-storage_path -encryption_iv')
            .lean();

        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        // Record access event
        if (recordAccess && mcpContext.user_id !== 'SYSTEM') {
            await custodyService.createEvent({
                evidence_id: evidenceId,
                action: 'VIEW_EVIDENCE',
                actor_id: mcpContext.user_id,
                actor_name: mcpContext.user_id,
                actor_role: mcpContext.role,
                details: { access_type: 'view_metadata' },
            }, mcpContext);

            // Increment access count
            await Evidence.updateOne(
                { evidence_id: evidenceId },
                { $inc: { access_count: 1 } }
            );
        }

        return evidence;
    }

    /**
     * Download evidence file. Decrypts and returns buffer.
     */
    async downloadEvidence(evidenceId, mcpContext) {
        const evidence = await Evidence.findOne({
            evidence_id: evidenceId,
            status: 'active',
        }).lean();

        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        if (evidence.is_locked && evidence.lock_expiry && new Date(evidence.lock_expiry) > new Date()) {
            throw new ValidationError(`Evidence is strictly locked for administrative review. Downloads are blocked until ${evidence.lock_expiry.toISOString()}`);
        }

        // Read encrypted file from storage
        const storage = getStorageDriver();
        const encryptedBuffer = await storage.read(evidence.storage_path);

        // Decrypt (pass auth tag for GCM, null for legacy CBC)
        const decryptedBuffer = decryptBuffer(
            encryptedBuffer,
            evidence.encryption_iv,
            evidence.encryption_auth_tag || null
        );

        // Record download event
        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'DOWNLOAD_EVIDENCE',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: { file_name: evidence.original_name },
        }, mcpContext);

        logger.info({ evidenceId, userId: mcpContext.user_id }, 'Evidence downloaded');

        return {
            buffer: decryptedBuffer,
            filename: evidence.original_name,
            mimetype: evidence.mime_type,
            fileHash: evidence.file_hash,
        };
    }

    /**
     * Sign evidence with a digital signature.
     */
    async signEvidence(evidenceId, privateKey, mcpContext) {
        const evidence = await Evidence.findOne({
            evidence_id: evidenceId,
            status: 'active',
        });

        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        // Sign the file hash
        const signature = signData(evidence.file_hash, privateKey);

        // Store signature
        evidence.digital_signatures.push({
            signer_id: mcpContext.user_id,
            signature,
            public_key: '', // Will be populated from user record
            signed_at: new Date(),
            data_hash: evidence.file_hash,
        });

        await evidence.save();

        // Record signing event
        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'SIGN_EVIDENCE',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: { signature_hash: generateBufferHash(Buffer.from(signature)) },
        }, mcpContext);

        logger.info({ evidenceId, userId: mcpContext.user_id }, 'Evidence signed');

        return { signed: true, evidence_id: evidenceId };
    }

    /**
     * Get evidence with internal fields (for verification).
     */
    async getEvidenceInternal(evidenceId) {
        return Evidence.findOne({ evidence_id: evidenceId }).lean();
    }

    /**
     * Update evidence metadata
     */
    async updateEvidenceMetadata(evidenceId, metadata, mcpContext) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId, status: 'active' });
        
        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        if (evidence.is_locked && evidence.lock_expiry && new Date(evidence.lock_expiry) > new Date()) {
            throw new ValidationError(`Asset is currently locked. Metadata updates are prohibited until ${evidence.lock_expiry.toISOString()}`);
        }

        const updates = {};
        if (metadata.description !== undefined) updates.description = metadata.description;
        if (metadata.tags !== undefined) updates.tags = metadata.tags;
        if (metadata.category !== undefined) updates.category = metadata.category;
        if (metadata.name !== undefined) updates.file_name = metadata.name; // Display name

        // === VERSION CONTROL: snapshot current state before overwriting ===
        const currentVersionCount = await EvidenceVersion.countDocuments({ evidence_id: evidenceId });
        const fieldChanges = Object.entries(updates).map(([field, newValue]) => ({
            field,
            old_value: evidence[field],
            new_value: newValue,
        }));
        if (fieldChanges.length > 0) {
            await EvidenceVersion.create({
                evidence_id: evidenceId,
                version_number: currentVersionCount + 1,
                snapshot: evidence.toObject(),
                changed_by: mcpContext?.user_id,
                changed_by_name: mcpContext?.username || mcpContext?.user_id,
                change_reason: metadata.change_reason || 'Metadata update',
                changes: fieldChanges,
            });
        }
        // ================================================================

        Object.assign(evidence, updates);
        await evidence.save();

        // Record custody event
        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'UPDATE_METADATA',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: { updated_fields: Object.keys(updates), version: currentVersionCount + 1 },
        }, mcpContext);

        logger.info({ evidenceId, userId: mcpContext.user_id, version: currentVersionCount + 1 }, 'Evidence metadata updated (versioned)');

        return evidence.toObject();
    }

    /**
     * Get version history for an evidence item
     */
    async getEvidenceVersions(evidenceId) {
        const versions = await EvidenceVersion.find({ evidence_id: evidenceId })
            .sort({ version_number: -1 })
            .lean();
        return versions;
    }

    /**
     * Lock Evidence (Time-Based Secure Locker)
     */
    async lockEvidence(evidenceId, durationHours, reason, mcpContext) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId, status: 'active' });
        
        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        const lockExpiry = new Date();
        lockExpiry.setHours(lockExpiry.getHours() + durationHours);

        evidence.is_locked = true;
        evidence.lock_expiry = lockExpiry;
        evidence.lock_reason = reason || 'Administrative lock';
        
        await evidence.save();

        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'LOCK_EVIDENCE',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: { lock_expiry: lockExpiry, reason },
        }, mcpContext);

        logger.info({ evidenceId, lockExpiry }, 'Evidence locked in secure locker');

        return evidence.toObject();
    }

    /**
     * Unlock Evidence (Re-readability & Transfer Enable)
     */
    async unlockEvidence(evidenceId, reason, mcpContext) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId, status: 'active' });
        
        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        if (!evidence.is_locked) {
            throw new ValidationError('Evidence is not currently locked');
        }

        evidence.is_locked = false;
        evidence.lock_expiry = null;
        evidence.lock_reason = null;
        
        await evidence.save();

        await custodyService.createEvent({
            evidence_id: evidenceId,
            action: 'UNLOCK_EVIDENCE',
            actor_id: mcpContext.user_id,
            actor_name: mcpContext.user_id,
            actor_role: mcpContext.role,
            details: { reason: reason || 'Authorized unlock' },
        }, mcpContext);

        logger.info({ evidenceId, userId: mcpContext.user_id }, 'Evidence unlocked');

        return evidence.toObject();
    }

    /**
     * Bulk action on multiple evidence items
     * Supported actions: delete, lock, archive
     */
    async bulkAction(action, evidenceIds, reason, mcpContext) {
        const results = { processed: 0, failed: 0, errors: [] };

        for (const evidenceId of evidenceIds) {
            try {
                if (action === 'delete') {
                    await Evidence.updateOne({ evidence_id: evidenceId }, { $set: { status: 'deleted' } });
                } else if (action === 'archive') {
                    await Evidence.updateOne({ evidence_id: evidenceId }, { $set: { status: 'archived' } });
                } else if (action === 'lock') {
                    await this.lockEvidence(evidenceId, 24, reason || 'Bulk Administrative Lock', mcpContext);
                } else {
                    throw new Error(`Unknown bulk action: ${action}`);
                }
                results.processed++;
            } catch (err) {
                results.failed++;
                results.errors.push({ evidence_id: evidenceId, error: err.message });
                logger.error({ evidenceId, action, err }, 'Bulk action failed for item');
            }
        }

        logger.info({ action, processed: results.processed, failed: results.failed }, 'Bulk evidence action completed');
        return results;
    }
}

export const evidenceService = new EvidenceService();
