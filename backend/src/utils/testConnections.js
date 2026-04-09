/**
 * TraceVault – Connection Test Utility
 *
 * Tests connectivity to all external services:
 *   - MongoDB Atlas
 *   - Upstash Redis
 *   - AWS S3
 *
 * Run: npm run test:connections
 */

import dotenv from 'dotenv';
dotenv.config();

import config from '../core/config.js';
import { logger } from './logger.js';

async function testMongoDB() {
    logger.info('Testing MongoDB connection...');
    try {
        const mongoose = await import('mongoose');
        await mongoose.default.connect(config.mongodb.uri, {
            serverSelectionTimeoutMS: 5000,
        });
        const admin = mongoose.default.connection.db.admin();
        const info = await admin.serverInfo();
        logger.info(`✅ MongoDB Atlas connected – version ${info.version}`);
        await mongoose.default.disconnect();
        return true;
    } catch (error) {
        logger.warn(`⚠️  MongoDB Atlas failed: ${error.message} - Attempting in-memory fallback...`);
        try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            process.env.MONGOMS_DOWNLOAD_DIR = './.mongo';
            process.env.MONGOMS_PREFER_GLOBAL_PATH = '1';
            process.env.MONGOMS_SYSTEM_BINARY = '';
            
            const mongoServer = await MongoMemoryServer.create({
                instance: { launchTimeout: 60000 },
                binary: { downloadDir: './.mongo' },
            });
            const uri = mongoServer.getUri();
            
            const mongoose = await import('mongoose');
            await mongoose.default.connect(uri);
            const admin = mongoose.default.connection.db.admin();
            const info = await admin.serverInfo();
            logger.info(`✅ In-memory MongoDB connected – version ${info.version}`);
            await mongoose.default.disconnect();
            await mongoServer.stop();
            return true;
        } catch (memErr) {
            logger.error(`❌ In-memory MongoDB failed: ${memErr.message}`);
            return false;
        }
    }
}

async function testRedis() {
    logger.info('Testing Upstash Redis connection...');
    if (!config.redis.url || !config.redis.token) {
        logger.warn('⚠️  Upstash Redis not configured – skipping');
        return true;
    }
    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: config.redis.url,
            token: config.redis.token,
        });
        const pong = await redis.ping();
        logger.info(`✅ Upstash Redis connected – ${pong}`);

        // Quick set/get test
        await redis.set('TraceVault:test', 'hello', { ex: 10 });
        const val = await redis.get('TraceVault:test');
        logger.info(`✅ Redis read/write OK – got: "${val}"`);
        await redis.del('TraceVault:test');
        return true;
    } catch (error) {
        logger.error(`❌ Redis failed: ${error.message}`);
        return false;
    }
}

async function testS3() {
    logger.info('Testing S3 connection...');
    if (config.storage.driver !== 's3') {
        logger.warn(`⚠️  Storage driver is "${config.storage.driver}" – skipping S3 test`);
        return true;
    }
    try {
        const { S3Client, ListBucketsCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
            region: config.storage.s3.region,
            credentials: {
                accessKeyId: config.storage.s3.accessKey,
                secretAccessKey: config.storage.s3.secretKey,
            },
            ...(config.storage.s3.endpoint && {
                endpoint: config.storage.s3.endpoint,
                forcePathStyle: true,
            }),
        });

        // Check if configured bucket exists
        await client.send(new HeadBucketCommand({ Bucket: config.storage.s3.bucket }));
        logger.info(`✅ S3 bucket "${config.storage.s3.bucket}" accessible`);
        return true;
    } catch (error) {
        if (error.name === 'NotFound') {
            logger.error(`❌ S3 bucket "${config.storage.s3.bucket}" does not exist`);
        } else if (error.name === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
            logger.error(`❌ S3 access denied – check your credentials`);
        } else {
            logger.error(`❌ S3 failed: ${error.message}`);
        }
        return false;
    }
}

async function main() {
    logger.info('═══════════════════════════════════════════════');
    logger.info(' TraceVault – Connection Test');
    logger.info('═══════════════════════════════════════════════');
    logger.info(`Environment: ${config.server.env}`);
    logger.info('');

    const results = {
        mongodb: await testMongoDB(),
        redis: await testRedis(),
        s3: await testS3(),
    };

    logger.info('');
    logger.info('═══════════════════════════════════════════════');
    logger.info(' Results');
    logger.info('═══════════════════════════════════════════════');

    for (const [service, ok] of Object.entries(results)) {
        logger.info(`  ${ok ? '✅' : '❌'} ${service}`);
    }

    const allOk = Object.values(results).every(Boolean);
    logger.info('');
    logger.info(allOk ? '🚀 All services operational!' : '⚠️  Some services failed – check above');
    process.exit(allOk ? 0 : 1);
}

main();
