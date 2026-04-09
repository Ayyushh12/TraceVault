import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    log_id: {
        type: String,
        required: true,
        unique: true,
    },
    request_id: {
        type: String,
        required: true,
        index: true,
    },
    user_id: {
        type: String,
        default: null,
        index: true,
    },
    user_role: {
        type: String,
        default: null,
    },
    actor_name: {
        type: String,
        default: null,
    },
    method: {
        type: String,
        required: true,
    },
    endpoint: {
        type: String,
        required: true,
        index: true,
    },
    action: {
        type: String,
        required: true,
    },
    status_code: {
        type: Number,
        required: true,
    },
    ip_address: {
        type: String,
        required: true,
    },
    mac_address: {
        type: String,
        default: null,
    },
    device_fingerprint: {
        type: String,
        default: null,
    },
    user_agent: {
        type: String,
        default: null,
    },
    request_body: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    response_time_ms: {
        type: Number,
        default: null,
    },
    error_message: {
        type: String,
        default: null,
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    },
    geo_location: {
        country: { type: String, default: null },
        city: { type: String, default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        source: { type: String, default: null },
    },
    archived: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: false,
    collection: 'audit_logs',
    strict: true,
});

// Compound indexes for queries
auditLogSchema.index({ user_id: 1, timestamp: -1 });
auditLogSchema.index({ endpoint: 1, timestamp: -1 });
auditLogSchema.index({ archived: 1 });
auditLogSchema.index({ 'geo_location.country': 1 });
auditLogSchema.index({ 'geo_location.city': 1 });

// Immutability enforcement
auditLogSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    // Only allow archiving
    if (update && update.$set && Object.keys(update.$set).length === 1 && update.$set.archived !== undefined) {
        return;
    }
    throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateOne', function () {
    const update = this.getUpdate();
    if (update && update.$set && Object.keys(update.$set).length === 1 && update.$set.archived !== undefined) {
        return;
    }
    throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateMany', function () {
    const update = this.getUpdate();
    if (update && update.$set && Object.keys(update.$set).length === 1 && update.$set.archived !== undefined) {
        return;
    }
    throw new Error('Audit logs are immutable and cannot be updated');
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
