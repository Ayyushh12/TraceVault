/**
 * Authentication Service
 *
 * Handles user registration, login, and JWT refresh tokens.
 * Integrated with brute-force protection and admin alerts.
 */

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../models/User.js';
import { UnauthorizedError, ConflictError, ValidationError } from '../utils/errors.js';
import { generateSigningKeyPair } from '../crypto/cryptoEngine.js';
import config from '../core/config.js';
import { cacheSet, cacheGet, cacheDelete } from '../core/redis.js';
import { logger } from '../utils/logger.js';
import { trackLoginAttempt } from './securityService.js';
import { sendSecurityAlert } from './emailService.js';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;

export class AuthService {
    /**
     * Register a new user.
     * @param {Object} data
     * @param {import('fastify').FastifyInstance} app - for JWT signing
     * @returns {Promise<Object>}
     */
    async register(data, app) {
        // Check for existing user
        const existing = await User.findOne({
            $or: [{ email: data.email }, { username: data.username }],
        });

        if (existing) {
            throw new ConflictError('User with this email or username already exists');
        }

        // Hash password
        const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);

        // Generate signing key pair
        const { publicKey, privateKey } = generateSigningKeyPair();

        const user = new User({
            user_id: crypto.randomUUID(),
            username: data.username,
            email: data.email,
            password_hash,
            role: data.role || 'investigator',
            full_name: data.full_name,
            department: data.department || null,
            badge_number: data.badge_number || null,
            public_key: publicKey,
        });

        await user.save();

        // Generate tokens
        const accessToken = this._signAccessToken(app, user);
        const refreshToken = await this._generateRefreshToken(user.user_id);

        logger.info({ userId: user.user_id, role: user.role }, 'User registered');

        // Alert admin of new registration
        sendSecurityAlert('NEW_REGISTRATION', {
            severity: 'low',
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department || 'Not specified',
            registration_time: new Date().toISOString(),
        }).catch(() => {});

        return {
            token: accessToken,
            refresh_token: refreshToken,
            expires_in: config.jwt.expiresIn,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                department: user.department,
                badge_number: user.badge_number,
            },
            // Return private key once — user must store it securely
            signing_keys: {
                public_key: publicKey,
                private_key: privateKey,
                warning: 'Store your private key securely. It will not be shown again.',
            },
        };
    }

    /**
     * Login user with brute-force protection.
     * @param {string} email
     * @param {string} password
     * @param {import('fastify').FastifyInstance} app
     * @param {Object} requestContext - { ip, userAgent }
     * @returns {Promise<Object>}
     */
    async login(email, password, app, requestContext = {}) {
        // Check for brute force lockout BEFORE any DB query
        const lockoutCheck = await trackLoginAttempt(email, false, {
            email,
            ip: requestContext.ip,
            userAgent: requestContext.userAgent,
        });

        // Rollback the failed attempt increment (we haven't actually checked yet)
        // We track AFTER the actual attempt below
        if (lockoutCheck.locked) {
            throw new UnauthorizedError(
                `Account temporarily locked. Try again after ${lockoutCheck.lockoutEnds || '15 minutes'}`
            );
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Track failed attempt
            await trackLoginAttempt(email, false, {
                email,
                ip: requestContext.ip,
                userAgent: requestContext.userAgent,
            });
            throw new UnauthorizedError('Invalid email or password');
        }

        if (!user.is_active) {
            throw new UnauthorizedError('Account is deactivated. Contact administrator.');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            // Track failed attempt
            await trackLoginAttempt(email, false, {
                email,
                ip: requestContext.ip,
                userAgent: requestContext.userAgent,
            });
            throw new UnauthorizedError('Invalid email or password');
        }

        // Login success — clear lockout tracking
        await trackLoginAttempt(email, true, {
            email,
            ip: requestContext.ip,
            userAgent: requestContext.userAgent,
        });

        // Update last login
        user.last_login = new Date();
        await user.save();

        // Track session for admin dashboard
        await cacheSet(`session:${user.user_id}`, JSON.stringify({
            ip: requestContext.ip,
            userAgent: requestContext.userAgent,
            timestamp: new Date().toISOString(),
        }), 1800); // 30 min TTL

        // Generate tokens
        const accessToken = this._signAccessToken(app, user);
        const refreshToken = await this._generateRefreshToken(user.user_id);

        logger.info({ userId: user.user_id }, 'User logged in');

        return {
            token: accessToken,
            refresh_token: refreshToken,
            expires_in: config.jwt.expiresIn,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                department: user.department,
                badge_number: user.badge_number,
                last_login: user.last_login,
            },
        };
    }

    /**
     * Refresh an access token using a refresh token.
     * @param {string} refreshToken
     * @param {import('fastify').FastifyInstance} app
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken, app) {
        // Look up the refresh token in cache
        const userId = await cacheGet(`refresh:${refreshToken}`);

        if (!userId) {
            throw new UnauthorizedError('Invalid or expired refresh token');
        }

        const user = await User.findOne({ user_id: userId });
        if (!user || !user.is_active) {
            throw new UnauthorizedError('User not found or deactivated');
        }

        // Rotate: invalidate old refresh token, issue new pair
        await cacheDelete(`refresh:${refreshToken}`);
        const newAccessToken = this._signAccessToken(app, user);
        const newRefreshToken = await this._generateRefreshToken(user.user_id);

        logger.info({ userId: user.user_id }, 'Token refreshed');

        return {
            token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_in: config.jwt.expiresIn,
        };
    }

    /**
     * Logout – invalidate refresh token.
     * @param {string} refreshToken
     */
    async logout(refreshToken) {
        if (refreshToken) {
            await cacheDelete(`refresh:${refreshToken}`);
        }
    }

    /**
     * Get user by ID.
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getUserById(userId) {
        const user = await User.findOne({ user_id: userId }).select('-password_hash');
        if (!user) return null;
        return user.toObject();
    }

    // ─── Private helpers ────────────────────────────────────

    _signAccessToken(app, user) {
        return app.jwt.sign({
            id: user.user_id,
            user_id: user.user_id,
            role: user.role,
            username: user.username,
        });
    }

    async _generateRefreshToken(userId) {
        const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
        // Parse refresh expiry (e.g. "7d" → seconds)
        const ttl = this._parseDuration(config.jwt.refreshExpiresIn);
        await cacheSet(`refresh:${token}`, userId, ttl);
        return token;
    }

    _parseDuration(str) {
        const match = str.match(/^(\d+)([smhd])$/);
        if (!match) return 604800; // default 7 days
        const val = parseInt(match[1], 10);
        switch (match[2]) {
            case 's': return val;
            case 'm': return val * 60;
            case 'h': return val * 3600;
            case 'd': return val * 86400;
            default: return 604800;
        }
    }
}

export const authService = new AuthService();
