import mongoose from 'mongoose';

const CUSTODY_ACTIONS = [
    'CREATE_EVIDENCE',
    'VIEW_EVIDENCE',
    'TRANSFER_CUSTODY',
    'VERIFY_EVIDENCE',
    'EXPORT_EVIDENCE',
    'DOWNLOAD_EVIDENCE',
    'SIGN_EVIDENCE',
];

const custodyEventSchema = new mongoose.Schema({
    event_id: {
        type: String,
        required: true,
        unique: true,
    },
    evidence_id: {
        type: String,
        required: true,
        index: true,
        ref: 'Evidence',
    },
    action: {
        type: String,
        required: true,
        enum: CUSTODY_ACTIONS,
    },
    actor_id: {
        type: String,
        required: true,
        ref: 'User',
    },
    actor_name: {
        type: String,
        required: true,
    },
    actor_role: {
        type: String,
        required: true,
    },
    previous_event_hash: {
        type: String,
        default: null,
    },
    event_hash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    ip_address: {
        type: String,
        required: true,
    },
    device_fingerprint: {
        type: String,
        required: true,
    },
    geo_location: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    request_id: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: false,
    collection: 'custody_events',
    // Enforce immutability — no updates allowed
    strict: true,
});

// Compound index for chain traversal
custodyEventSchema.index({ evidence_id: 1, timestamp: 1 });

// Prevent updates to custody events (immutability enforcement)
custodyEventSchema.pre('findOneAndUpdate', function () {
    throw new Error('Custody events are immutable and cannot be updated');
});

custodyEventSchema.pre('updateOne', function () {
    throw new Error('Custody events are immutable and cannot be updated');
});

custodyEventSchema.pre('updateMany', function () {
    throw new Error('Custody events are immutable and cannot be updated');
});

const CustodyEvent = mongoose.model('CustodyEvent', custodyEventSchema);
export { CUSTODY_ACTIONS };
export default CustodyEvent;
