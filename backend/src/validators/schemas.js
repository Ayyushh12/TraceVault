/**
 * Request validators using Zod schemas
 */

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────────────────────

export const registerSchema = z.object({
    username: z.string().min(3).max(50).trim(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(8).max(128),
    full_name: z.string().min(2).max(100).trim(),
    role: z.enum(['admin', 'investigator', 'auditor', 'viewer']).optional().default('investigator'),
    department: z.string().max(100).trim().optional(),
    badge_number: z.string().max(50).trim().optional(),
});

export const loginSchema = z.object({
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(1),
});

// ──────────────────────────────────────────────────────────────
// CASES
// ──────────────────────────────────────────────────────────────

export const createCaseSchema = z.object({
    case_name: z.string().min(3).max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    classification: z.enum(['unclassified', 'confidential', 'restricted', 'official', 'secret', 'top_secret']).optional().default('unclassified'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional().default('medium'),
    case_type: z.enum(['investigation', 'incident_response', 'compliance', 'litigation', 'other']).optional().default('investigation'),
    status: z.enum(['open', 'active', 'investigating', 'in_progress', 'closed', 'archived']).optional().default('open'),
    investigators: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
});

export const updateCaseSchema = z.object({
    case_name: z.string().min(3).max(200).trim().optional(),
    description: z.string().max(2000).trim().optional(),
    status: z.enum(['open', 'active', 'investigating', 'in_progress', 'closed', 'archived']).optional(),
    classification: z.enum(['unclassified', 'confidential', 'restricted', 'official', 'secret', 'top_secret']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    case_type: z.enum(['investigation', 'incident_response', 'compliance', 'litigation', 'other']).optional(),
    investigators: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
});

// ──────────────────────────────────────────────────────────────
// EVIDENCE
// ──────────────────────────────────────────────────────────────

export const uploadEvidenceSchema = z.object({
    case_id: z.string().min(1),
    description: z.string().max(2000).trim().optional(),
    tags: z.array(z.string()).optional().default([]),
    name: z.string().optional(),
    category: z.enum(['documents', 'images', 'audio', 'video', 'forensic_image', 'logs', 'other']).optional().default('other'),
});

export const updateEvidenceSchema = z.object({
    description: z.string().max(2000).trim().optional(),
    tags: z.array(z.string()).optional(),
    category: z.enum(['documents', 'images', 'audio', 'video', 'forensic_image', 'logs', 'other']).optional(),
    name: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────
// CUSTODY
// ──────────────────────────────────────────────────────────────

export const transferCustodySchema = z.object({
    evidence_id: z.string().min(1),
    new_custodian_id: z.string().min(1),
    reason: z.string().max(500).trim().optional(),
});

// ──────────────────────────────────────────────────────────────
// QUERY PARAMS
// ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(20),
    sort: z.string().optional().default('-created_at'),
});

export const auditQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
    user_id: z.string().optional(),
    endpoint: z.string().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
});

// ──────────────────────────────────────────────────────────────
// SEARCH
// ──────────────────────────────────────────────────────────────

export const searchSchema = z.object({
    q: z.string().min(1).max(200).trim(),
    type: z.enum(['all', 'evidence', 'cases', 'users']).optional().default('all'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

/**
 * Validate data against a Zod schema.
 * @param {z.ZodSchema} schema
 * @param {any} data
 * @returns {Object} parsed & validated data
 */
export function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.validation = errors;
        throw err;
    }
    return result.data;
}
