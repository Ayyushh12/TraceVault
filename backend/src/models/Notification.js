import mongoose from 'mongoose';

/**
 * Event triggers mentioned: Evidence integrity failure, hash mismatch, unauthorized access, excessive downloads, 
 * new device login, admin actions, system errors, background job failures.
 * Severity classification: CRITICAL, WARNING, INFO, SYSTEM.
 */

const notificationSchema = new mongoose.Schema({
    user_id: {
        type: String, // Platforms uses UUID strings for user identities
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['SECURITY', 'SYSTEM', 'EVIDENCE', 'CUSTODY', 'ADMIN'],
        required: true
    },
    severity: {
        type: String,
        enum: ['CRITICAL', 'WARNING', 'INFO', 'SYSTEM'],
        default: 'INFO',
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    event_type: {
        type: String,
        required: true, // e.g., HASH_MISMATCH, RAPID_CUSTODY, MASS_DOWNLOAD
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // flexible
        default: {}
    },
    action_url: {
        type: String // URL link attached to the notification
    },
    priority_score: {
        type: Number,
        default: 0 // Calculated dynamically based on Severity + Frequency + User Risk
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    read_at: {
        type: Date
    },
    snoozed_until: {
        type: Date
    },
    is_escalated: {
        type: Boolean,
        default: false
    },
    group_count: {
        type: Number,
        default: 1 // Support grouping of duplicate events
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// TTL index to automatically prune regular notifications after 90 days.
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
