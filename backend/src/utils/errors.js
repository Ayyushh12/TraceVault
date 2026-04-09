/**
 * Custom application error classes for TraceVault
 */

export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.details = details;
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class TamperingDetectedError extends AppError {
    constructor(message = 'Evidence tampering detected') {
        super(message, 422, 'TAMPERING_DETECTED');
        this.name = 'TamperingDetectedError';
    }
}

export class IntegrityError extends AppError {
    constructor(message = 'Integrity verification failed') {
        super(message, 422, 'INTEGRITY_ERROR');
        this.name = 'IntegrityError';
    }
}
