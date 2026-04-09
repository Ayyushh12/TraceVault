/**
 * Request Fingerprinting & Security Middleware
 *
 * Validates content types, prevents path traversal,
 * and adds security checks for file uploads.
 */

import path from 'node:path';
import { ValidationError } from '../utils/errors.js';

// Allowed MIME types for evidence uploads
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp',
    'video/mp4',
    'video/avi',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'application/zip',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/octet-stream',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/x-pcap',
    'application/vnd.tcpdump.pcap',
];

// Dangerous file extensions
const DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs',
    '.js', '.ws', '.wsf', '.msi', '.dll', '.sys',
];

/**
 * Validate uploaded file for forensic evidence.
 * @param {string} filename
 * @param {string} mimetype
 * @param {number} fileSize
 */
export function validateFileUpload(filename, mimetype, fileSize) {
    // Check for path traversal attempts
    const normalizedName = path.basename(filename);
    if (normalizedName !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new ValidationError('Invalid filename: path traversal detected');
    }

    // Check extension
    const ext = path.extname(filename).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
        throw new ValidationError(`File extension '${ext}' is not allowed for evidence upload`);
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new ValidationError(`MIME type '${mimetype}' is not allowed for evidence upload`);
    }

    // Check file size (max 100MB)
    const maxSize = 104857600;
    if (fileSize > maxSize) {
        throw new ValidationError(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }
}

/**
 * Sanitize a filename for safe storage.
 * @param {string} original
 * @returns {string}
 */
export function sanitizeFilename(original) {
    return original
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 255);
}

export { ALLOWED_MIME_TYPES };
