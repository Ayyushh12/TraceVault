/**
 * TraceVault Cryptographic Engine — Industry Grade
 *
 * LEVEL 1: SHA-256 (basic)
 * LEVEL 2: Multi-hash (SHA-256 + SHA-1 + MD5), Ed25519 signatures, trusted timestamp
 * LEVEL 3: Chunk-based hashing, Merkle Tree verification, fuzzy hash (SSDEEP-style)
 *
 * Used in: Autopsy, EnCase, FTK, X-Ways Forensics
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import config from '../core/config.js';

const AUTH_TAG_LENGTH = 16;
const IV_LENGTH_GCM = 12;
const IV_LENGTH_CBC = 16;

// ─── CHUNK CONFIG ────────────────────────────────────────────────
// 4 MB chunks — same as EnCase forensic imaging default
const CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

// ─── FORENSIC SIGNATURES (Magic Bytes) ────────────────────
const MAGIC_BYTES = {
    'pdf':  '25504446',         // %PDF
    'jpg':  'ffd8ff',           // JPEG
    'jpeg': 'ffd8ff',
    'png':  '89504e47',         // .PNG
    'gif':  '47494638',         // GIF8
    'zip':  '504b0304',         // PK..
    'exe':  '4d5a',             // MZ
    'docx': '504b0304',         // Office XML (ZIP)
    'xlsx': '504b0304',
    'pptx': '504b0304',
    'doc':  'd0cf11e0',         // OLE CF
    'xls':  'd0cf11e0',
    'ppt':  'd0cf11e0',
    'sqlite': '53514c69',       // SQLite
    'db':   '53514c69',
};

// ─── LEVEL 1 & 2: MULTI-HASH FILE HASHING ───────────────────────

/**
 * Generate SHA-256 hash of a stream (fast, streaming, memory-safe).
 */
export async function generateFileHash(stream) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of stream) {
        hash.update(chunk);
    }
    return hash.digest('hex');
}

/**
 * Generate multi-algorithm hash from a Buffer.
 * Returns: { sha256, sha1, md5 }
 *
 * Why multiple? Different courts and labs require different standards.
 * MD5 for legacy compatibility, SHA-1 for intermediate, SHA-256 for primary.
 */
export function generateMultiHash(buffer) {
    return {
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        sha1:   crypto.createHash('sha1').update(buffer).digest('hex'),
        md5:    crypto.createHash('md5').update(buffer).digest('hex'),
    };
}

/**
 * Verify multi-hash → ALL three must match.
 * Returns: { valid, mismatches: [] }
 */
export function verifyMultiHash(buffer, stored) {
    const computed = generateMultiHash(buffer);
    const mismatches = [];

    for (const algo of ['sha256', 'sha1', 'md5']) {
        if (!stored[algo] || computed[algo] !== stored[algo]) {
            mismatches.push({ algorithm: algo, expected: stored[algo], computed: computed[algo] });
        }
    }

    return { valid: mismatches.length === 0, computed, mismatches };
}

/**
 * Generate SHA-256 from path (streaming — no memory blowup).
 */
export async function generateFileHashFromPath(filePath) {
    const stream = fs.createReadStream(filePath);
    return generateFileHash(stream);
}

/**
 * Generate SHA-256 from Buffer.
 */
export function generateBufferHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ─── LEVEL 3A: CHUNK-BASED HASHING ──────────────────────────────
/**
 * Split a buffer into fixed-size chunks, hash each chunk.
 * Returns: { chunks: [{index, offset, size, hash}], chunk_count, chunk_size_bytes }
 *
 * Why: Partial tampering detection — if 1 chunk is altered, we know exactly WHERE.
 * Used in: FTK Imager, dc3dd, Guymager
 */
export function generateChunkHashes(buffer, chunkSize = CHUNK_SIZE_BYTES) {
    const chunks = [];
    let offset = 0;
    let index = 0;

    while (offset < buffer.length) {
        const slice = buffer.slice(offset, offset + chunkSize);
        const hash = crypto.createHash('sha256').update(slice).digest('hex');
        chunks.push({
            index,
            offset,
            size: slice.length,
            hash,
        });
        offset += chunkSize;
        index++;
    }

    return {
        chunks,
        chunk_count: chunks.length,
        chunk_size_bytes: chunkSize,
        total_size: buffer.length,
    };
}

/**
 * Verify chunk hashes — returns which chunks are intact vs tampered.
 * Returns: { valid, tampered_chunks: [{index, offset}], intact_count, tampered_count }
 */
export function verifyChunkHashes(buffer, storedChunks, chunkSize = CHUNK_SIZE_BYTES) {
    const tampered = [];
    let intact = 0;

    for (const stored of storedChunks) {
        const slice = buffer.slice(stored.offset, stored.offset + stored.size);
        const computed = crypto.createHash('sha256').update(slice).digest('hex');

        if (computed !== stored.hash) {
            tampered.push({
                index: stored.index,
                offset: stored.offset,
                size: stored.size,
                expected_hash: stored.hash,
                computed_hash: computed,
            });
        } else {
            intact++;
        }
    }

    return {
        valid: tampered.length === 0,
        intact_count: intact,
        tampered_count: tampered.length,
        tampered_chunks: tampered,
    };
}

// ─── LEVEL 3B: MERKLE TREE ───────────────────────────────────────
/**
 * Build a Merkle tree from chunk hashes.
 *
 * A Merkle tree allows:
 * - O(log n) proof of any chunk's membership
 * - Root hash = full file integrity proof
 * - Fast re-verification of partial changes
 *
 * Used in: blockchain systems, Git, Certificate Transparency
 *
 * @param {string[]} leafHashes - hex SHA-256 hashes of each chunk
 * @returns {{ root: string, levels: string[][], leaf_count: number }}
 */
export function buildMerkleTree(leafHashes) {
    if (!leafHashes || leafHashes.length === 0) {
        return { root: null, levels: [], leaf_count: 0 };
    }

    const levels = [leafHashes];
    let currentLevel = leafHashes;

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left; // duplicate last if odd
            const parent = crypto
                .createHash('sha256')
                .update(left + right)
                .digest('hex');
            nextLevel.push(parent);
        }
        levels.push(nextLevel);
        currentLevel = nextLevel;
    }

    return {
        root: currentLevel[0],
        levels,
        leaf_count: leafHashes.length,
    };
}

/**
 * Verify a Merkle proof for a single leaf.
 * Returns true if the leaf is part of the tree with the given root.
 */
export function verifyMerkleProof(leafHash, proof, root) {
    let current = leafHash;
    for (const { sibling, position } of proof) {
        current = position === 'right'
            ? crypto.createHash('sha256').update(current + sibling).digest('hex')
            : crypto.createHash('sha256').update(sibling + current).digest('hex');
    }
    return current === root;
}

/**
 * Generate Merkle proof for a specific leaf index.
 */
export function generateMerkleProof(leafHashes, targetIndex) {
    const tree = buildMerkleTree(leafHashes);
    const proof = [];
    let index = targetIndex;
    let currentLevel = tree.levels[0];

    for (let l = 0; l < tree.levels.length - 1; l++) {
        currentLevel = tree.levels[l];
        const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
        const sibling = currentLevel[siblingIndex] || currentLevel[index]; // handle odd

        proof.push({
            sibling,
            position: index % 2 === 0 ? 'right' : 'left',
        });

        index = Math.floor(index / 2);
    }

    return { proof, root: tree.root, target_index: targetIndex };
}

// ─── LEVEL 3C: FUZZY HASH (ssdeep-style) ────────────────────────
/**
 * Similarity hashing — detect "near-duplicate" or "slightly modified" files.
 *
 * Real ssdeep uses fuzzy piece hashing. We implement a lightweight
 * rolling-window approach using 7-char block hashes, which captures
 * file similarity well enough for forensic triage.
 *
 * Use case: detect malware variants, edited images, partially overwritten drives.
 *
 * @param {Buffer} buffer
 * @returns {{ hash: string, block_size: number, similarity_token: string }}
 */
export function generateFuzzyHash(buffer) {
    // Calculate block size (from ssdeep's log2 block sizing)
    const blockSize = computeFuzzyBlockSize(buffer.length);
    const blockHash = computeFuzzyBlocks(buffer, blockSize);
    const halfBlockHash = computeFuzzyBlocks(buffer, blockSize * 2);

    // Format: blocksize:hash1:hash2 (compatible with ssdeep output format)
    const hash = `${blockSize}:${blockHash}:${halfBlockHash}`;

    return {
        hash,
        block_size: blockSize,
        similarity_token: blockHash.slice(0, 8), // fast similarity prefix
    };
}

/**
 * Compare two fuzzy hashes and return a similarity score (0-100).
 * 0 = completely different, 100 = identical
 */
export function compareFuzzyHashes(hash1, hash2) {
    if (!hash1 || !hash2) return 0;
    const [, h1] = hash1.split(':');
    const [, h2] = hash2.split(':');
    if (!h1 || !h2) return 0;

    // Edit distance-based similarity
    const distance = levenshteinDistance(h1, h2);
    const maxLen = Math.max(h1.length, h2.length);
    if (maxLen === 0) return 100;

    return Math.round((1 - distance / maxLen) * 100);
}

function computeFuzzyBlockSize(fileSize) {
    const MIN_BLOCK = 3;
    let bs = MIN_BLOCK;
    while (bs * 64 < fileSize) bs *= 2;
    return bs;
}

function computeFuzzyBlocks(buffer, blockSize) {
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const MAX_BLOCKS = 64;
    let result = '';
    let h = 0x27C4BB;  // rolling hash seed

    for (let i = 0; i < buffer.length; i++) {
        h = ((h << 5) ^ (h >>> 27)) ^ buffer[i];
        h = h >>> 0; // keep 32-bit
        if ((i + 1) % blockSize === 0 && result.length < MAX_BLOCKS) {
            result += B64[h % 64];
        }
    }

    // Finalize last partial block
    if (result.length < MAX_BLOCKS) {
        result += B64[h % 64];
    }

    return result;
}

function levenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
            else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

// ─── TRUSTED TIMESTAMPING ────────────────────────────────────────
/**
 * Generate a trusted timestamp for a hash.
 *
 * Real RFC 3161 timestamping uses a trusted TSA (timestamp authority).
 * We simulate this with: hash + ISO8601 time + HMAC signature using the server key.
 * This proves the file existed at this hash value at this exact time.
 *
 * @param {string} fileHash - SHA-256 hex of the file
 * @param {string} serverId - identifier for this server instance
 * @returns {{ timestamp: string, hash: string, nonce: string, signature: string, server_id: string }}
 */
export function generateTrustedTimestamp(fileHash, serverId = 'TraceVault-tsa') {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // The payload to sign
    const payload = `${fileHash}|${timestamp}|${nonce}|${serverId}`;

    // HMAC-SHA256 using the server's encryption key as the signing key
    const hmacKey = crypto.createHash('sha256')
        .update(config.encryption?.key || 'TraceVault-default-key')
        .digest();

    const signature = crypto.createHmac('sha256', hmacKey)
        .update(payload)
        .digest('hex');

    return { timestamp, hash: fileHash, nonce, signature, server_id: serverId };
}

/**
 * Verify a trusted timestamp.
 * Returns { valid, timestamp, error? }
 */
export function verifyTrustedTimestamp(fileHash, storedTimestamp) {
    try {
        const { timestamp, nonce, signature, server_id } = storedTimestamp;
        const payload = `${fileHash}|${timestamp}|${nonce}|${server_id}`;

        const hmacKey = crypto.createHash('sha256')
            .update(config.encryption?.key || 'TraceVault-default-key')
            .digest();

        const expected = crypto.createHmac('sha256', hmacKey)
            .update(payload)
            .digest('hex');

        const valid = crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signature, 'hex')
        );

        return { valid, timestamp, server_id };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}

// ─── EVENT HASH CHAIN ────────────────────────────────────────────
/**
 * Generate tamper-evident event hash for custody chain.
 * SHA256(evidence_id + prev_hash + actor + action + timestamp + device + ip)
 */
export function generateEventHash({
    evidence_id, previous_event_hash, actor_id, action_type,
    timestamp, device_fingerprint, ip_address,
}) {
    const payload = [
        evidence_id,
        previous_event_hash || 'GENESIS',
        actor_id,
        action_type,
        timestamp,
        device_fingerprint || 'unknown',
        ip_address || 'unknown',
    ].join('|');

    return crypto.createHash('sha256').update(payload).digest('hex');
}

export function verifyEventHash(params, storedHash) {
    const calculated = generateEventHash(params);
    if (calculated.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(
        Buffer.from(calculated, 'hex'),
        Buffer.from(storedHash, 'hex')
    );
}

export function verifyHash(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash1, 'hex'), Buffer.from(hash2, 'hex'));
}

// ─── LEDGER ANCHOR ───────────────────────────────────────────────
export function generateAnchorHash(eventHashes) {
    const combined = [...eventHashes].sort().join('|');
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// ─── AES-256-GCM ENCRYPTION ──────────────────────────────────────
function isGCM() { return config.encryption?.algorithm === 'aes-256-gcm'; }
function deriveKey(secret) { return crypto.createHash('sha256').update(secret || 'default').digest(); }

export function encryptBuffer(buffer) {
    const key = deriveKey(config.encryption?.key);
    if (isGCM()) {
        const iv = crypto.randomBytes(IV_LENGTH_GCM);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        return { encrypted, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
    }
    const iv = crypto.randomBytes(IV_LENGTH_CBC);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return { encrypted: Buffer.concat([cipher.update(buffer), cipher.final()]), iv: iv.toString('hex') };
}

export function decryptBuffer(encryptedBuffer, ivHex, authTagHex = null) {
    const key = deriveKey(config.encryption?.key);
    const iv = Buffer.from(ivHex, 'hex');
    if (isGCM() && authTagHex) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

export async function encryptStream(inputStream, outputPath) {
    const key = deriveKey(config.encryption?.key);
    if (isGCM()) {
        const iv = crypto.randomBytes(IV_LENGTH_GCM);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
        const outputStream = fs.createWriteStream(outputPath);
        await pipeline(inputStream, cipher, outputStream);
        return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
    }
    const iv = crypto.randomBytes(IV_LENGTH_CBC);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const outputStream = fs.createWriteStream(outputPath);
    await pipeline(inputStream, cipher, outputStream);
    return { iv: iv.toString('hex') };
}

export function decryptStream(inputPath, ivHex, authTagHex = null) {
    const key = deriveKey(config.encryption?.key);
    const iv = Buffer.from(ivHex, 'hex');
    const inputStream = fs.createReadStream(inputPath);
    if (isGCM() && authTagHex) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return inputStream.pipe(decipher);
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return inputStream.pipe(decipher);
}

// ─── Ed25519 DIGITAL SIGNATURES ──────────────────────────────────
export function generateSigningKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}

export function signData(data, privateKeyPem) {
    return crypto.sign(null, Buffer.from(data), privateKeyPem).toString('base64');
}

export function verifySignature(data, signatureBase64, publicKeyPem) {
    return crypto.verify(null, Buffer.from(data), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
}

// ─── DEEP FORENSIC LOGICS ────────────────────────────────────────

/**
 * Calculate Shannon Entropy of a buffer.
 * Score: 0 (fixed value) to 8 (fully random/encrypted).
 *
 * Forensic use: High entropy (> 7.5) indicates encryption,
 * compression, or hidden data (steganography).
 */
export function calculateEntropy(buffer) {
    if (buffer.length === 0) return 0;

    const freq = new Array(256).fill(0);
    for (let i = 0; i < buffer.length; i++) {
        freq[buffer[i]]++;
    }

    let entropy = 0;
    for (let i = 0; i < 256; i++) {
        if (freq[i] > 0) {
            const p = freq[i] / buffer.length;
            entropy -= p * Math.log2(p);
        }
    }

    return parseFloat(entropy.toFixed(4));
}

/**
 * Verify if file magic bytes match its reported extension.
 * Detects "Extension Spoofing" (e.g. mal.exe renamed to safe.jpg).
 */
export function verifyFileSignature(buffer, extension) {
    if (!extension || buffer.length === 0) return { valid: true };

    const ext = extension.toLowerCase().replace('.', '');
    const expectedMagic = MAGIC_BYTES[ext];
    if (!expectedMagic) return { valid: true, unknown_ext: true };

    const magicLen = Math.ceil(expectedMagic.length / 2);
    const actualMagic = buffer.slice(0, magicLen).toString('hex').toLowerCase();

    const valid = actualMagic.startsWith(expectedMagic.toLowerCase());

    return {
        valid,
        expected: expectedMagic,
        actual: actualMagic,
        extension: ext
    };
}
