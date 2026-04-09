import 'dotenv/config';
import mongoose from 'mongoose';
import { auditService } from './services/auditService.js';
import { connectDatabase } from './core/database.js';

async function run() {
    await connectDatabase();
    try {
        const res = await auditService.getActivityAnalytics(30);
        console.log("SUCCESS:", Object.keys(res));
    } catch(e) {
        console.error("ERROR:");
        console.error(e);
    }
    process.exit(0);
}

run();
