import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password_hash: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'investigator', 'auditor', 'viewer'],
        default: 'investigator',
        required: true,
    },
    full_name: {
        type: String,
        required: true,
        trim: true,
    },
    department: {
        type: String,
        trim: true,
    },
    badge_number: {
        type: String,
        trim: true,
    },
    public_key: {
        type: String,
        default: null,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    // ─── Governance & Access Control ─────────────────────
    approval_status: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'approved',
    },
    approved_by: {
        type: String,
        default: null,
    },
    classification_clearance: {
        type: String,
        enum: ['unclassified', 'confidential', 'secret', 'top_secret'],
        default: 'unclassified',
    },
    // Custom permission overrides (admin can grant extra or revoke)
    permissions_override: {
        granted: [{ type: String }],
        revoked: [{ type: String }],
    },
    // Security tracking
    failed_login_count: {
        type: Number,
        default: 0,
    },
    locked_until: {
        type: Date,
        default: null,
    },
    password_changed_at: {
        type: Date,
        default: null,
    },
    // Admin notes on user
    admin_notes: {
        type: String,
        maxlength: 2000,
        default: null,
    },
    last_login: {
        type: Date,
        default: null,
    },
    last_login_ip: {
        type: String,
        default: null,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users',
});

userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);
export default User;
