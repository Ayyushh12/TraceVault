import mongoose from 'mongoose';

const chunkHashSchema = new mongoose.Schema({
    index:  { type: Number, required: true },
    offset: { type: Number, required: true },
    size:   { type: Number, required: true },
    hash:   { type: String, required: true },
}, { _id: false });

const trustedTimestampSchema = new mongoose.Schema({
    timestamp: String,
    hash:      String,
    nonce:     String,
    signature: String,
    server_id: String,
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
    evidence_id: { type: String, required: true, unique: true, index: true },
    case_id:     { type: String, required: true, index: true, ref: 'Case' },
    file_name:   { type: String, required: true, trim: true },
    original_name: { type: String, required: true, trim: true },
    mime_type:   { type: String, required: true },
    file_size:   { type: Number, required: true },

    // ── Level 1: Primary hash (SHA-256) ──────────────────────────
    file_hash: { type: String, required: true, index: true },

    // ── Level 2: Multi-hash verification ─────────────────────────
    hash_sha1: { type: String, default: null },
    hash_md5:  { type: String, default: null },

    // ── Level 2: Trusted timestamp (RFC 3161 simulation) ─────────
    trusted_timestamp: { type: trustedTimestampSchema, default: null },

    // ── Level 3: Chunk-based hashing (4 MB blocks) ───────────────
    chunk_hashes:     { type: [chunkHashSchema], default: [] },
    chunk_size_bytes: { type: Number, default: null },
    chunk_count:      { type: Number, default: 0 },

    // ── Level 3: Merkle Tree root hash ────────────────────────────
    merkle_root: { type: String, default: null },

    // ── Level 3: Fuzzy hash (SSDEEP-style similarity) ────────────
    fuzzy_hash: { type: String, default: null },

    // ── Integrity tracking ───────────────────────────────────────
    integrity_status: {
        type: String,
        enum: ['verified', 'tampered', 'pending', 'unverified'],
        default: 'pending',
        index: true,
    },
    integrity_history: [{
        verified_at:     { type: Date, default: Date.now },
        verified_by:     String,
        result:          { type: String, enum: ['pass', 'fail'] },
        method:          { type: String, enum: ['multi_hash', 'chunk', 'merkle', 'basic'] },
        tampered_chunks: [Number],
        details:         mongoose.Schema.Types.Mixed,
        _id: false,
    }],
    last_verified_at:   { type: Date, default: null },
    last_verified_hash: { type: String, default: null },

    // ── Storage & Encryption ─────────────────────────────────────
    storage_path:         { type: String, required: true },
    encryption_iv:        { type: String, required: true },
    encryption_auth_tag:  { type: String, default: null },
    encryption_algorithm: { type: String, enum: ['aes-256-gcm', 'aes-256-cbc'], default: 'aes-256-gcm' },
    storage_driver:       { type: String, enum: ['local', 's3'], default: 'local' },

    // ── Metadata ─────────────────────────────────────────────────
    description: { type: String, trim: true, maxlength: 2000 },
    category: {
        type: String,
        enum: ['documents', 'images', 'audio', 'video', 'forensic_image', 'logs', 'other'],
        default: 'other',
    },
    tags: [{ type: String, trim: true }],

    uploaded_by:       { type: String, required: true, ref: 'User' },
    uploaded_by_name:  { type: String, default: null },
    current_custodian: { type: String, required: true, ref: 'User' },

    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active',
    },
    access_count: { type: Number, default: 0 },

    // ── Evidence Locker ───────────────────────────────────────────
    is_locked:   { type: Boolean, default: false },
    lock_expiry: { type: Date, default: null },
    lock_reason: { type: String, default: null },

    // ── Digital Signatures ────────────────────────────────────────
    digital_signatures: [{
        signer_id:  { type: String, ref: 'User' },
        signature:  String,
        public_key: String,
        signed_at:  { type: Date, default: Date.now },
        data_hash:  String,
    }],

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'evidences',
});

evidenceSchema.index({ case_id: 1, created_at: -1 });
evidenceSchema.index({ uploaded_by: 1 });
evidenceSchema.index({ current_custodian: 1 });
evidenceSchema.index({ status: 1 });
evidenceSchema.index({ merkle_root: 1 });

const Evidence = mongoose.model('Evidence', evidenceSchema);
export default Evidence;
