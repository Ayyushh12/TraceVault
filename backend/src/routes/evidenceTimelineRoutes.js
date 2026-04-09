/**
 * Evidence Timeline Routes
 * Operational Layer — Full lifecycle of evidence items
 * NOT the legal custody chain — this tracks operational history
 */
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import AuditLog from '../models/AuditLog.js';
import CustodyEvent from '../models/CustodyEvent.js';
import Evidence from '../models/Evidence.js';

const EVIDENCE_ACTIONS = [
  'CREATE:EVIDENCE', 'READ:EVIDENCE', 'UPDATE:EVIDENCE', 'DELETE:EVIDENCE',
  'evidence_upload', 'evidence_verify', 'evidence_access', 'evidence_download',
];

export async function evidenceTimelineRoutes(app) {
  app.addHook('preHandler', authenticate);

  /**
   * GET /evidence-timeline — All operational events for one or all evidence items
   */
  app.get('/evidence-timeline', {
    preHandler: [requirePermission('evidence:view')],
  }, async (req, reply) => {
    const { evidence_id, page = 1, limit = 100, action_type, start_date, end_date } = req.query;

    // Build query — match by action name OR by endpoint pattern
    // This catches events from before the audit action naming fix
    const orConditions = [
      { action: { $in: EVIDENCE_ACTIONS } },
      { endpoint: { $regex: /^\/evidence/ } },
      { endpoint: { $regex: /^\/evidence-timeline/ } },
    ];

    const query = { $or: orConditions };

    if (action_type && action_type !== 'all') {
      // Override $or — filter by specific action only
      delete query.$or;
      query.action = action_type;
    }

    if (evidence_id) {
        // Optimized DB-level filter — try to match evidence_id in endpoint or body
        // This is much faster than fetching everything and filtering in JS
        const idRegex = new RegExp(evidence_id, 'i');
        const originalOr = query.$or || [];
        query.$or = [
            ...originalOr,
            { endpoint: { $regex: idRegex } },
            { 'request_body.evidence_id': evidence_id }
        ];
    }

    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }

    let auditEvents = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Exclude timeline and verify-chain self-referential audit entries
    auditEvents = auditEvents.filter(e =>
      !e.endpoint?.startsWith('/evidence-timeline') &&
      !e.endpoint?.startsWith('/health')
    );

    // No longer filtering in memory for performance

    // Normalize action names for events that have endpoint-based detection
    auditEvents = auditEvents.map(e => {
      if (!EVIDENCE_ACTIONS.includes(e.action) && e.endpoint?.startsWith('/evidence')) {
        // Derive correct action from method + endpoint
        const methodMap = { GET: 'READ', POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
        const subParts = e.endpoint.split('/').filter(Boolean);
        const subAction = subParts.length >= 3 ? subParts[subParts.length - 1] : null;
        const subActionMap = { verify: 'evidence_verify', download: 'evidence_download', upload: 'evidence_upload', analyze: 'evidence_access' };
        if (subAction && subActionMap[subAction]) {
          return { ...e, action: subActionMap[subAction] };
        }
        return { ...e, action: `${methodMap[e.method] || e.method}:EVIDENCE` };
      }
      return e;
    });

    // Enrich with evidence filename where possible
    const enriched = await Promise.all(auditEvents.map(async (log) => {
      const evIdMatch = log.endpoint?.match(/\/evidence\/([\w-]+)/);
      let evidenceName = null;
      if (evIdMatch) {
        const ev = await Evidence.findOne({ evidence_id: evIdMatch[1] }).select('file_name original_name').lean();
        evidenceName = ev?.original_name || ev?.file_name || null;
      }
      return { ...log, evidence_name: evidenceName };
    }));

    // Stats
    const stats = {
      total: enriched.length,
      uploads: enriched.filter(e => e.action === 'CREATE:EVIDENCE' || e.action === 'evidence_upload').length,
      accesses: enriched.filter(e => e.action === 'READ:EVIDENCE' || e.action === 'evidence_access').length,
      updates: enriched.filter(e => e.action === 'UPDATE:EVIDENCE').length,
      deletions: enriched.filter(e => e.action === 'DELETE:EVIDENCE').length,
    };

    return reply.send({
      success: true,
      data: {
        events: enriched,
        stats,
        unique_evidence: [...new Set(enriched.map(e => {
          const m = e.endpoint?.match(/\/evidence\/([\w-]+)/);
          return m ? m[1] : null;
        }).filter(Boolean))].length,
      },
    });
  });

  /**
   * GET /evidence-timeline/summary — Per-evidence action counts
   */
  app.get('/evidence-timeline/summary', {
    preHandler: [requirePermission('evidence:view')],
  }, async (req, reply) => {
    const pipeline = [
      { $match: { action: { $in: EVIDENCE_ACTIONS } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    const distribution = await AuditLog.aggregate(pipeline).exec();
    return reply.send({ success: true, data: { distribution } });
  });
}
