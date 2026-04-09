/**
 * Session Routes
 * Security Layer — Tracks login sessions, device, IP, session duration
 */
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import AuditLog from '../models/AuditLog.js';

export async function sessionRoutes(app) {
  app.addHook('preHandler', authenticate);

  /**
   * GET /sessions — Returns login sessions derived from auth audit logs
   * Groups CREATE:AUTH events into user sessions with duration calculation
   */
  app.get('/sessions', {
    preHandler: [requirePermission('audit:view')],
  }, async (req, reply) => {
    const { limit = 100, user_id, days = 30 } = req.query;

    const cutoff = new Date(Date.now() - parseInt(days) * 86400 * 1000);
    const query = {
      timestamp: { $gte: cutoff },
      action: { $in: ['CREATE:AUTH', 'CREATE:LOGIN'] },
    };
    if (user_id) query.user_id = user_id;

    const authLogs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Compute derived session data
    const sessions = authLogs.map((log, i) => {
      const success = (log.status_code || 200) < 400;
      // Estimate session duration from gap to next auth event for same user
      const nextAuth = authLogs.slice(i + 1).find(l => l.user_id === log.user_id);
      const durationMs = nextAuth
        ? new Date(log.timestamp).getTime() - new Date(nextAuth.timestamp).getTime()
        : null;
      const durationMin = durationMs ? Math.abs(Math.round(durationMs / 60000)) : null;

      return {
        session_id: log.log_id,
        user_id: log.user_id,
        actor_name: log.actor_name || null,
        user_role: log.user_role,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        device_fingerprint: log.device_fingerprint,
        status: success ? 'success' : 'failed',
        timestamp: log.timestamp,
        duration_minutes: durationMin,
        endpoint: log.endpoint,
        method: log.method,
        status_code: log.status_code,
      };
    });

    // Stats
    const total = sessions.length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const successSessions = sessions.filter(s => s.status === 'success').length;
    const uniqueUsers = new Set(sessions.map(s => s.user_id).filter(Boolean)).size;
    const uniqueIPs = new Set(sessions.map(s => s.ip_address).filter(Boolean)).size;

    // IP frequency (for anomaly detection)
    const ipFreq = {};
    sessions.forEach(s => {
      if (s.ip_address) ipFreq[s.ip_address] = (ipFreq[s.ip_address] || 0) + 1;
    });
    const suspiciousIPs = Object.entries(ipFreq)
      .filter(([, count]) => count >= 3 && sessions.filter(s => s.ip_address === _ip && s.status === 'failed').length >= 2)
      .map(([ip, count]) => ({ ip, count }));

    return reply.send({
      success: true,
      data: {
        sessions,
        stats: { total, success: successSessions, failed, uniqueUsers, uniqueIPs },
        ip_frequency: Object.entries(ipFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count })),
      },
    });
  });

  /**
   * GET /sessions/stats — Quick session statistics
   */
  app.get('/sessions/stats', {
    preHandler: [requirePermission('audit:view')],
  }, async (req, reply) => {
    const { days = 7 } = req.query;
    const cutoff = new Date(Date.now() - parseInt(days) * 86400 * 1000);

    const [total, failed, uniqueUsersResult] = await Promise.all([
      AuditLog.countDocuments({ action: { $in: ['CREATE:AUTH', 'CREATE:LOGIN'] }, timestamp: { $gte: cutoff } }),
      AuditLog.countDocuments({ action: { $in: ['CREATE:AUTH', 'CREATE:LOGIN'] }, status_code: { $gte: 400 }, timestamp: { $gte: cutoff } }),
      AuditLog.distinct('user_id', { action: { $in: ['CREATE:AUTH', 'CREATE:LOGIN'] }, timestamp: { $gte: cutoff } }),
    ]);

    return reply.send({
      success: true,
      data: {
        total_sessions: total,
        failed_sessions: failed,
        success_rate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
        unique_users: uniqueUsersResult.filter(Boolean).length,
      },
    });
  });
}
