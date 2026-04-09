/**
 * Model Context Protocol (MCP) – Centralized Request Context Manager
 *
 * Creates a forensic context object for every request, ensuring
 * complete traceability across all services.
 */

import crypto from 'node:crypto';
import geoip from 'geoip-lite';

/**
 * @typedef {Object} MCPContext
 * @property {string} request_id      - Unique request identifier
 * @property {string|null} user_id    - Authenticated user ID
 * @property {string|null} role       - User role
 * @property {string|null} investigation_id - Active investigation/case ID
 * @property {string} ip_address      - True client origin IP
 * @property {string|null} mac_address - Hardware Identifer (Forensic MAC equivalent)
 * @property {string} device_fingerprint - Client device cryptographic profile
 * @property {string} timestamp       - ISO 8601 timestamp
 * @property {Object|null} geo_location - Geolocation data
 */

export class MCPContextManager {
    /**
     * Build context from a Fastify request.
     * @param {import('fastify').FastifyRequest} request
     * @returns {MCPContext}
     */
    static fromRequest(request) {
        const user = request.user || {};
        const headers = request.headers || {};
        const ip = MCPContextManager.extractRealIp(request, headers);

        return {
            request_id: request.id || crypto.randomUUID(),
            user_id: user.id || user.user_id || null,
            username: user.name || user.username || null,
            role: user.role || null,
            investigation_id: request.params?.caseId
                || request.body?.case_id
                || headers['x-investigation-id']
                || null,
            ip_address: ip,
            // Prioritize X-Hardware-ID from our forensic frontend service
            mac_address: headers['x-hardware-id'] || headers['x-mac-address'] || null,
            device_fingerprint: headers['x-device-fingerprint'] || MCPContextManager.deriveFingerprint(headers, request),
            timestamp: new Date().toISOString(),
            geo_location: MCPContextManager.extractGeoLocation(headers, ip),
        };
    }

    /**
     * Create a system context for background jobs and internal operations.
     * @param {string} jobName
     * @returns {MCPContext}
     */
    static systemContext(jobName = 'system') {
        return {
            request_id: crypto.randomUUID(),
            user_id: 'SYSTEM',
            role: 'system',
            investigation_id: null,
            ip_address: '127.0.0.1',
            mac_address: '00:00:00:00:00:00',
            device_fingerprint: `system:${jobName}`,
            timestamp: new Date().toISOString(),
            geo_location: null,
        };
    }

    /**
     * Parse all proxy tiers to locate the True Original IP.
     * @param {import('fastify').FastifyRequest} request
     * @param {Object} headers
     * @returns {string}
     */
    static extractRealIp(request, headers) {
        const xForwardedFor = headers['x-forwarded-for'];
        if (xForwardedFor) {
            // Can be a comma-separated list: client, proxy1, proxy2. First is client.
            const ips = xForwardedFor.split(',').map(ip => ip.trim());
            if (ips.length > 0 && ips[0]) return ips[0];
        }

        return headers['true-client-ip'] || 
               headers['cf-connecting-ip'] || 
               headers['x-real-ip'] || 
               headers['fastly-client-ip'] ||
               headers['x-client-ip'] ||
               headers['x-cluster-client-ip'] ||
               headers['forwarded-for'] ||
               request.ip || 
               request.socket?.remoteAddress || 
               'unknown';
    }

    /**
     * Derive a deterministic device forensic fingerprint.
     * @param {Object} headers
     * @param {import('fastify').FastifyRequest} request
     * @returns {string}
     */
    static deriveFingerprint(headers, request) {
        const components = [
            headers['user-agent'] || 'unknown-agent',
            headers['accept-language'] || '',
            headers['accept-encoding'] || '',
            headers['sec-ch-ua'] || '', // Chrome UA fingerprint extensions
            headers['sec-ch-ua-platform'] || '',
            headers['sec-ch-ua-arch'] || '',
            headers['sec-ch-ua-model'] || '',
            headers['sec-ch-ua-mobile'] || '',
            headers['x-forwarded-proto'] || 'unknown', // HTTP vs HTTPS origin flag
        ].join('|');

        return 'fp_' + crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
    }

    /**
     * Extract geolocation from headers or local database.
     * @param {Object} headers
     * @param {string} ip
     * @returns {Object|null}
     */
    static extractGeoLocation(headers, ip) {
        // 1. Try CDN/Proxy headers first (highly accurate if present)
        const countryFromHeader = headers['cf-ipcountry'] || headers['x-country-code'];
        const cityFromHeader = headers['x-city'];
        const latFromHeader = headers['x-latitude'];
        const lonFromHeader = headers['x-longitude'];

        if (countryFromHeader || cityFromHeader) {
            return {
                country: countryFromHeader || null,
                city: cityFromHeader || null,
                latitude: latFromHeader ? parseFloat(latFromHeader) : null,
                longitude: lonFromHeader ? parseFloat(lonFromHeader) : null,
                source: 'gateway_header'
            };
        }

        // 2. Fallback to local geoip-lite if IP is valid and not local
        if (ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== 'unknown') {
            const geo = geoip.lookup(ip);
            if (geo) {
                return {
                    country: geo.country || null,
                    region: geo.region || null,
                    city: geo.city || null,
                    latitude: geo.ll ? geo.ll[0] : null,
                    longitude: geo.ll ? geo.ll[1] : null,
                    range: geo.range,
                    source: 'geoip_lite'
                };
            }
        }

        return null;
    }

    /**
     * Serialize context for logging.
     * @param {MCPContext} context
     * @returns {string}
     */
    static serialize(context) {
        return JSON.stringify(context);
    }
}
