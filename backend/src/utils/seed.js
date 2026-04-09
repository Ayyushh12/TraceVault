/**
 * Database Seeder
 *
 * Creates default admin user for initial setup.
 * Run via: npm run seed
 */

import { connectDatabase, disconnectDatabase, createIndexes } from '../core/database.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { generateSigningKeyPair } from '../crypto/cryptoEngine.js';
import { logger } from './logger.js';

async function seed() {
    logger.info('Starting database seeder...');

    await connectDatabase();
    await createIndexes();

    // Check if admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
        // Update existing admin with new credentials
        const passwordHash = await bcrypt.hash('Admin@123', 12);
        await User.updateOne({ role: 'admin' }, {
            $set: {
                email: 'meenaayushhh141@gmail.com',
                password_hash: passwordHash,
                username: 'admin',
                full_name: 'System Administrator',
            }
        });
        logger.info('Admin user updated with new credentials: meenaayushhh141@gmail.com / Admin@123');
    } else {
        const passwordHash = await bcrypt.hash('Admin@123', 12);
        const { publicKey } = generateSigningKeyPair();

        const admin = new User({
            user_id: crypto.randomUUID(),
            username: 'admin',
            email: 'meenaayushhh141@gmail.com',
            password_hash: passwordHash,
            role: 'admin',
            full_name: 'System Administrator',
            department: 'Security Operations',
            badge_number: 'ADMIN-001',
            public_key: publicKey,
        });

        await admin.save();
        logger.info({
            userId: admin.user_id,
            email: admin.email,
            role: admin.role,
        }, 'Default admin user created');
        logger.info('Admin credentials: meenaayushhh141@gmail.com / Admin@123');
    }

    // Create or update analyst user
    const existingAnalyst = await User.findOne({ email: 'cybernetic26@proton.me' });

    if (existingAnalyst) {
        const passwordHash = await bcrypt.hash('Ayush@123', 12);
        await User.updateOne({ email: 'cybernetic26@proton.me' }, {
            $set: {
                password_hash: passwordHash,
                username: 'cybernetic26',
                full_name: 'Cybernetic Analyst',
            }
        });
        logger.info('Analyst user updated with new credentials: cybernetic26@proton.me / Ayush@123');
    } else {
        const passwordHash = await bcrypt.hash('Ayush@123', 12);
        const { publicKey } = generateSigningKeyPair();

        const analyst = new User({
            user_id: crypto.randomUUID(),
            username: 'cybernetic26',
            email: 'cybernetic26@proton.me',
            password_hash: passwordHash,
            role: 'investigator',
            full_name: 'Cybernetic Analyst',
            department: 'Cyber Forensics',
            badge_number: 'INV-026',
            public_key: publicKey,
        });

        await analyst.save();
        logger.info('Analyst user created: cybernetic26@proton.me / Ayush@123');
    }

    // Create a sample investigator
    const existingInvestigator = await User.findOne({ username: 'investigator1' });

    if (!existingInvestigator) {
        const passwordHash = await bcrypt.hash('invest123!@#', 12);
        const { publicKey } = generateSigningKeyPair();

        const investigator = new User({
            user_id: crypto.randomUUID(),
            username: 'investigator1',
            email: 'investigator@TraceVault.local',
            password_hash: passwordHash,
            role: 'investigator',
            full_name: 'John Investigator',
            department: 'Cyber Forensics',
            badge_number: 'INV-001',
            public_key: publicKey,
        });

        await investigator.save();
        logger.info('Sample investigator user created');
    }

    // Create a sample auditor
    const existingAuditor = await User.findOne({ username: 'auditor1' });

    if (!existingAuditor) {
        const passwordHash = await bcrypt.hash('audit123!@#', 12);
        const { publicKey } = generateSigningKeyPair();

        const auditor = new User({
            user_id: crypto.randomUUID(),
            username: 'auditor1',
            email: 'auditor@TraceVault.local',
            password_hash: passwordHash,
            role: 'auditor',
            full_name: 'Jane Auditor',
            department: 'Compliance',
            badge_number: 'AUD-001',
            public_key: publicKey,
        });

        await auditor.save();
        logger.info('Sample auditor user created');
    }

    await disconnectDatabase();
    logger.info('Database seeding complete');
}

seed().then(() => process.exit(0)).catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exit(1);
});
