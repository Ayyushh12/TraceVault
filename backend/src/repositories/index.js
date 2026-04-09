/**
 * Repositories Index
 *
 * Repository pattern for data access abstraction.
 * Currently using Mongoose models directly.
 * Repositories can be extended for more complex queries.
 */

import User from '../models/User.js';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import CustodyEvent from '../models/CustodyEvent.js';
import AuditLog from '../models/AuditLog.js';
import LedgerAnchor from '../models/LedgerAnchor.js';

export class BaseRepository {
    constructor(model) {
        this.model = model;
    }

    async findById(id, idField = '_id') {
        return this.model.findOne({ [idField]: id }).lean();
    }

    async findAll(query = {}, options = {}) {
        const { sort = { created_at: -1 }, skip = 0, limit = 20 } = options;
        return this.model.find(query).sort(sort).skip(skip).limit(limit).lean();
    }

    async count(query = {}) {
        return this.model.countDocuments(query);
    }

    async create(data) {
        const doc = new this.model(data);
        await doc.save();
        return doc.toObject();
    }
}

export const userRepository = new BaseRepository(User);
export const caseRepository = new BaseRepository(Case);
export const evidenceRepository = new BaseRepository(Evidence);
export const custodyEventRepository = new BaseRepository(CustodyEvent);
export const auditLogRepository = new BaseRepository(AuditLog);
export const ledgerAnchorRepository = new BaseRepository(LedgerAnchor);
