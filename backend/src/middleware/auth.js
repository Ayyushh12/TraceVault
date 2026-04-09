/**
 * JWT Authentication Middleware
 */

import { UnauthorizedError } from '../utils/errors.js';

export async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
    } catch (err) {
        throw new UnauthorizedError('Invalid or expired authentication token');
    }
}

/**
 * Optional authentication — sets user if token present, continues otherwise.
 */
export async function optionalAuth(request, reply) {
    try {
        await request.jwtVerify();
    } catch {
        request.user = null;
    }
}
