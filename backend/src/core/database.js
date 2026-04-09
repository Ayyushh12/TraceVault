import mongoose from 'mongoose';
import config from './config.js';
import { logger } from '../utils/logger.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let connection = null;
let mongoServer = null;

export async function connectDatabase() {
    try {
        connection = await mongoose.connect(config.mongodb.uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        logger.info(`MongoDB connected: ${connection.connection.host}`);

        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        return connection;
    } catch (error) {
        logger.warn(`Failed to connect to primary MongoDB. Starting in-memory fallback... (${error.message})`);
        try {
            process.env.MONGOMS_DOWNLOAD_DIR = './.mongo';
            process.env.MONGOMS_PREFER_GLOBAL_PATH = '1';
            process.env.MONGOMS_SYSTEM_BINARY = '';
            
            mongoServer = await MongoMemoryServer.create({
                instance: {
                    launchTimeout: 60000, // 60 seconds for slow starts / first download
                },
                binary: {
                    downloadDir: './.mongo',
                },
            });
            const uri = mongoServer.getUri();
            connection = await mongoose.connect(uri, {
                maxPoolSize: 10,
            });
            logger.info(`In-memory MongoDB connected: ${connection.connection.host}`);
            
            // Re-seed admin user
            const db = mongoose.connection.db;
            const usersCollection = db.collection('users');
            const bcrypt = (await import('bcryptjs')).default;
            
            // Seed analyst user
            const analystHash = await bcrypt.hash('Ayush@123', 10);
            await usersCollection.insertOne({
                user_id: 'USR-ANALYST',
                full_name: 'Cybernetic Analyst',
                username: 'cybernetic26',
                email: 'cybernetic26@proton.me',
                password_hash: analystHash,
                role: 'investigator',
                department: 'Cyber Forensics',
                is_active: true,
                status: 'active',
                created_at: new Date()
            });
            logger.info('Seeded analyst user: cybernetic26@proton.me');

            // Seed admin user
            const adminHash = await bcrypt.hash('Admin@123', 10);
            await usersCollection.insertOne({
                user_id: 'USR-ADMIN',
                full_name: 'System Administrator',
                username: 'admin',
                email: 'meenaayushhh141@gmail.com',
                password_hash: adminHash,
                role: 'admin',
                department: 'Administration',
                is_active: true,
                status: 'active',
                created_at: new Date()
            });
            logger.info('Seeded admin user: meenaayushhh141@gmail.com');
            
        } catch (innerErr) {
            logger.error('Failed to connect to in-memory MongoDB:', innerErr);
            process.exit(1);
        }
        return connection;
    }
}

export async function disconnectDatabase() {
    if (connection) {
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        logger.info('MongoDB disconnected gracefully');
    }
}

export async function createIndexes() {
    const db = mongoose.connection.db;

    // Evidence indexes
    const evidenceCollection = db.collection('evidences');
    await evidenceCollection.createIndex({ evidence_id: 1 }, { unique: true });
    await evidenceCollection.createIndex({ case_id: 1 });
    await evidenceCollection.createIndex({ created_at: -1 });
    await evidenceCollection.createIndex({ file_hash: 1 });

    // Custody events indexes
    const custodyCollection = db.collection('custody_events');
    await custodyCollection.createIndex({ evidence_id: 1 });
    await custodyCollection.createIndex({ event_hash: 1 }, { unique: true });
    await custodyCollection.createIndex({ timestamp: -1 });
    await custodyCollection.createIndex({ evidence_id: 1, timestamp: 1 });

    // Audit logs indexes
    const auditCollection = db.collection('audit_logs');
    await auditCollection.createIndex({ request_id: 1 });
    await auditCollection.createIndex({ user_id: 1 });
    await auditCollection.createIndex({ timestamp: -1 });
    await auditCollection.createIndex({ endpoint: 1 });

    // Ledger anchors indexes
    const ledgerCollection = db.collection('ledger_anchors');
    await ledgerCollection.createIndex({ anchor_date: 1 }, { unique: true });
    await ledgerCollection.createIndex({ created_at: -1 });

    // Cases indexes
    const casesCollection = db.collection('cases');
    await casesCollection.createIndex({ case_id: 1 }, { unique: true });
    await casesCollection.createIndex({ created_by: 1 });
    await casesCollection.createIndex({ status: 1 });

    logger.info('Database indexes created successfully');
}
