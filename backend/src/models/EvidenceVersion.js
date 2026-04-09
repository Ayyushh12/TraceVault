/**
 * EvidenceVersion — tracks previous states of evidence metadata.
 * Each time an evidence record is updated we snapshot the old version here.
 */

import mongoose from 'mongoose';

const EvidenceVersionSchema = new mongoose.Schema(
    {
        evidence_id: { type: String, required: true, index: true },
        version_number: { type: Number, required: true },
        snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // full evidence doc
        changed_by: { type: String },         // user_id
        changed_by_name: { type: String },
        change_reason: { type: String, default: 'Metadata update' },
        changes: [
            {
                field: String,
                old_value: mongoose.Schema.Types.Mixed,
                new_value: mongoose.Schema.Types.Mixed,
            },
        ],
    },
    { timestamps: { createdAt: 'created_at' } }
);

EvidenceVersionSchema.index({ evidence_id: 1, version_number: -1 });

export default mongoose.model('EvidenceVersion', EvidenceVersionSchema);
