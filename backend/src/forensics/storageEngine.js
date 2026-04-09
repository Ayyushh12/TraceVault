/**
 * File Storage Abstraction Layer
 *
 * Supports local and S3-compatible storage drivers.
 * Evidence files are stored encrypted with AES-256-GCM.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from '../core/config.js';
import { logger } from '../utils/logger.js';

// ──────────────────────────────────────────────────────────────
// LOCAL STORAGE DRIVER
// ──────────────────────────────────────────────────────────────

class LocalStorageDriver {
    constructor() {
        this.basePath = path.resolve(config.storage.local.path);
        this._ensureDirectory(this.basePath);
        logger.info(`Local storage driver initialized at: ${this.basePath}`);
    }

    _ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Store a file buffer.
     * @param {string} filename
     * @param {Buffer} buffer
     * @param {string} caseId
     * @returns {Promise<string>} storage path
     */
    async store(filename, buffer, caseId) {
        const caseDir = path.join(this.basePath, caseId);
        this._ensureDirectory(caseDir);

        const storageName = `${crypto.randomUUID()}_${filename}`;
        const filePath = path.join(caseDir, storageName);

        await fs.promises.writeFile(filePath, buffer);
        logger.debug(`File stored locally: ${filePath} (${buffer.length} bytes)`);

        return path.relative(this.basePath, filePath);
    }

    /**
     * Read a file.
     * @param {string} relativePath
     * @returns {Promise<Buffer>}
     */
    async read(relativePath) {
        const fullPath = path.join(this.basePath, relativePath);

        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Path traversal detected');
        }

        return fs.promises.readFile(fullPath);
    }

    /**
     * Get a readable stream.
     * @param {string} relativePath
     * @returns {import('fs').ReadStream}
     */
    readStream(relativePath) {
        const fullPath = path.join(this.basePath, relativePath);

        if (!fullPath.startsWith(this.basePath)) {
            throw new Error('Path traversal detected');
        }

        return fs.createReadStream(fullPath);
    }

    /**
     * Check if file exists.
     * @param {string} relativePath
     * @returns {Promise<boolean>}
     */
    async exists(relativePath) {
        const fullPath = path.join(this.basePath, relativePath);
        try {
            await fs.promises.access(fullPath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete a file (soft delete — rename with .deleted suffix).
     * @param {string} relativePath
     */
    async delete(relativePath) {
        const fullPath = path.join(this.basePath, relativePath);
        const deletedPath = `${fullPath}.deleted.${Date.now()}`;
        await fs.promises.rename(fullPath, deletedPath);
        logger.info(`File soft-deleted: ${fullPath}`);
    }
}

// ──────────────────────────────────────────────────────────────
// S3 STORAGE DRIVER (fully integrated with AWS SDK v3)
// ──────────────────────────────────────────────────────────────

class S3StorageDriver {
    constructor() {
        this.bucket = config.storage.s3.bucket;
        this.region = config.storage.s3.region;
        this.s3Client = null;
        this.multipartThreshold = config.storage.multipartThresholdMB * 1024 * 1024;
        this.partSize = config.storage.partSizeMB * 1024 * 1024;
        this._initPromise = this._init();
    }

    async _init() {
        try {
            const { S3Client } = await import('@aws-sdk/client-s3');

            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: config.storage.s3.accessKey,
                    secretAccessKey: config.storage.s3.secretKey,
                },
                ...(config.storage.s3.endpoint && {
                    endpoint: config.storage.s3.endpoint,
                    forcePathStyle: true,
                }),
            });

            logger.info(`S3 storage driver initialized: bucket=${this.bucket}, region=${this.region}`);
        } catch (error) {
            logger.error({ err: error }, 'Failed to initialize S3 client. Install @aws-sdk/client-s3');
            throw new Error('S3 driver requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3');
        }
    }

    async _getClient() {
        await this._initPromise;
        if (!this.s3Client) {
            throw new Error('S3 client not initialized');
        }
        return this.s3Client;
    }

    /**
     * Store a file buffer in S3.
     * Uses multipart upload for large files.
     */
    async store(filename, buffer, caseId) {
        const client = await this._getClient();
        const key = `evidence/${caseId}/${crypto.randomUUID()}_${filename}`;

        if (config.storage.multipartUpload && buffer.length > this.multipartThreshold) {
            await this._multipartUpload(client, key, buffer);
        } else {
            await this._simpleUpload(client, key, buffer);
        }

        logger.info(`S3 stored: s3://${this.bucket}/${key} (${buffer.length} bytes)`);
        return key;
    }

    async _simpleUpload(client, key, buffer) {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        await client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ServerSideEncryption: 'AES256',
            ContentLength: buffer.length,
        }));
    }

    async _multipartUpload(client, key, buffer) {
        const {
            CreateMultipartUploadCommand,
            UploadPartCommand,
            CompleteMultipartUploadCommand,
            AbortMultipartUploadCommand,
        } = await import('@aws-sdk/client-s3');

        const { UploadId } = await client.send(new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            ServerSideEncryption: 'AES256',
        }));

        const parts = [];
        let partNumber = 1;

        try {
            for (let offset = 0; offset < buffer.length; offset += this.partSize) {
                const chunk = buffer.subarray(offset, offset + this.partSize);
                const { ETag } = await client.send(new UploadPartCommand({
                    Bucket: this.bucket,
                    Key: key,
                    UploadId,
                    PartNumber: partNumber,
                    Body: chunk,
                }));
                parts.push({ ETag, PartNumber: partNumber });
                logger.debug(`S3 multipart: part ${partNumber} uploaded (${chunk.length} bytes)`);
                partNumber++;
            }

            await client.send(new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: key,
                UploadId,
                MultipartUpload: { Parts: parts },
            }));

            logger.info(`S3 multipart upload completed: ${parts.length} parts`);
        } catch (error) {
            // Abort on failure
            await client.send(new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: key,
                UploadId,
            })).catch(() => {});
            throw error;
        }
    }

    /**
     * Read a file from S3.
     */
    async read(key) {
        const client = await this._getClient();
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');

        const response = await client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));

        // Collect the stream into a buffer
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    /**
     * Get a readable stream from S3.
     */
    async readStream(key) {
        const client = await this._getClient();
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');

        const response = await client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));

        return response.Body;
    }

    /**
     * Check if file exists in S3.
     */
    async exists(key) {
        try {
            const client = await this._getClient();
            const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
            await client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
            return true;
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Delete a file from S3 (adds a delete marker – versioned buckets keep history).
     */
    async delete(key) {
        const client = await this._getClient();
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

        await client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));

        logger.info(`S3 deleted: s3://${this.bucket}/${key}`);
    }
}

// ──────────────────────────────────────────────────────────────
// FACTORY
// ──────────────────────────────────────────────────────────────

let driverInstance = null;

/**
 * Get the configured storage driver.
 * @returns {LocalStorageDriver | S3StorageDriver}
 */
export function getStorageDriver() {
    if (!driverInstance) {
        switch (config.storage.driver) {
            case 's3':
                driverInstance = new S3StorageDriver();
                break;
            case 'local':
            default:
                driverInstance = new LocalStorageDriver();
                break;
        }
    }
    return driverInstance;
}

export { LocalStorageDriver, S3StorageDriver };
