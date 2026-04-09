import mongoose from 'mongoose';

const ledgerAnchorSchema = new mongoose.Schema({
    anchor_id: {
        type: String,
        required: true,
        unique: true,
    },
    anchor_date: {
        type: String, // YYYY-MM-DD
        required: true,
        unique: true,
        index: true,
    },
    anchor_hash: {
        type: String,
        required: true,
    },
    event_count: {
        type: Number,
        required: true,
    },
    event_hashes: [{
        type: String,
    }],
    previous_anchor_hash: {
        type: String,
        default: null,
    },
    created_at: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: false,
    collection: 'ledger_anchors',
    strict: true,
});

// Immutability
ledgerAnchorSchema.pre('findOneAndUpdate', function () {
    throw new Error('Ledger anchors are immutable');
});
ledgerAnchorSchema.pre('updateOne', function () {
    throw new Error('Ledger anchors are immutable');
});
ledgerAnchorSchema.pre('updateMany', function () {
    throw new Error('Ledger anchors are immutable');
});

const LedgerAnchor = mongoose.model('LedgerAnchor', ledgerAnchorSchema);
export default LedgerAnchor;
