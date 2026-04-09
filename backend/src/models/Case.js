import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
    case_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    case_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000,
    },
    created_by: {
        type: String,
        required: true,
        ref: 'User',
    },
    investigators: [{
        type: String,
        ref: 'User',
    }],
    status: {
        type: String,
        enum: ['open', 'active', 'investigating', 'in_progress', 'closed', 'archived'],
        default: 'open',
    },
    priority: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium',
    },
    classification: {
        type: String,
        enum: ['unclassified', 'confidential', 'restricted', 'official', 'secret', 'top_secret'],
        default: 'unclassified',
    },
    case_type: {
        type: String,
        enum: ['investigation', 'incident_response', 'compliance', 'litigation', 'other'],
        default: 'investigation',
    },
    tags: [{
        type: String,
        trim: true,
    }],
    evidence_count: {
        type: Number,
        default: 0,
    },
    notes: [{
        author_id: { type: String, ref: 'User' },
        author_name: String,
        content: String,
        created_at: { type: Date, default: Date.now },
    }],
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
    closed_at: {
        type: Date,
        default: null,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'cases',
});

caseSchema.index({ created_by: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ priority: 1 });
caseSchema.index({ created_at: -1 });

const Case = mongoose.model('Case', caseSchema);
export default Case;
