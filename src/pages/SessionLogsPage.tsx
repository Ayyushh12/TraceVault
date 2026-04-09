/**
 * Session Logs — Security Layer
 *
 * NOT Audit Logs (system) or Activity Tracking (behavior).
 * Purpose: Track each login session — device, IP, duration, status.
 *
 * Real forensic tools use this to detect:
 * - Unauthorized access from unusual IPs
 * - Brute force (repeated failed logins)
 * - Off-hours access
 * - Session hijacking
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  LogIn, LogOut, Shield, Laptop, Smartphone, Monitor, Hash,
  Globe, Clock, AlertTriangle, CheckCircle2, XCircle, Search,
  RefreshCw, Filter, User, Fingerprint, BarChart2, X, Bot,
  Key, MapPin, Zap, Ban, ShieldAlert, Info, TimerOff, CalendarCheck
} from 'lucide-react';
import { useSessionLogs, useSessionStats } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Device detection ────────────────────────────────────────
function parseDevice(ua: string = '') {
  if (!ua) return { icon: Monitor, label: 'Unknown', type: 'unknown' };
  const u = ua.toLowerCase();
  if (u.includes('bot') || u.includes('crawl') || u.includes('spider')) return { icon: Bot, label: 'Bot / Crawler', type: 'bot' };
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone') || u.includes('ipad')) return { icon: Smartphone, label: 'Mobile', type: 'mobile' };
  if (u.includes('curl') || u.includes('python') || u.includes('axios') || u.includes('postman')) return { icon: Hash, label: 'API Client', type: 'api' };
  if (u.includes('windows') || u.includes('mac') || u.includes('linux')) return { icon: Laptop, label: 'Desktop', type: 'desktop' };
  return { icon: Monitor, label: 'Browser', type: 'browser' };
}

// ── Risk scoring ─────────────────────────────────────────────
function sessionRisk(session: any): { level: 'low' | 'medium' | 'high' | 'critical'; reasons: string[] } {
  const reasons: string[] = [];
  const hour = new Date(session.timestamp).getHours();

  if (session.status === 'failed') reasons.push('Authentication failed');
  if (hour < 6 || hour > 22) reasons.push('Off-hours access');
  if (parseDevice(session.user_agent).type === 'api') reasons.push('API client login');
  if (parseDevice(session.user_agent).type === 'bot') reasons.push('Bot user-agent detected');

  const level = reasons.length >= 3 ? 'critical' : reasons.length >= 2 ? 'high' : reasons.length >= 1 ? 'medium' : 'low';
  return { level, reasons };
}

const RISK_CONFIG = {
  low:      { label: 'Low',      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  medium:   { label: 'Medium',   color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  high:     { label: 'High',     color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

const SESSION_FILTERS = [
  { id: 'all',    label: 'All Sessions' },
  { id: 'success', label: 'Successful' },
  { id: 'failed', label: 'Failed' },
  { id: 'risk',   label: 'High Risk' },
];

const DAYS_OPTIONS = [7, 14, 30, 90];

const SessionLogsPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [days, setDays] = useState(30);

  const { data, isLoading, isFetching, refetch } = useSessionLogs({ days, limit: 200 });
  const { data: statsData } = useSessionStats({ days });

  const sessions = useMemo(() => {
    const list = data?.sessions || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list : [];
  }, [data]);

  const apiStats = data?.stats || {};
  const ipFrequency: { ip: string; count: number }[] = data?.ip_frequency || [];

  // Stats
  const stats = useMemo(() => ({
    total: sessions.length,
    success: sessions.filter((s: any) => s.status === 'success').length,
    failed: sessions.filter((s: any) => s.status === 'failed').length,
    highRisk: sessions.filter((s: any) => sessionRisk(s).level === 'high' || sessionRisk(s).level === 'critical').length,
    uniqueIPs: new Set(sessions.map((s: any) => s.ip_address).filter(Boolean)).size,
  }), [sessions]);

  // Filter
  const filtered = useMemo(() => {
    return sessions.filter((s: any) => {
      const matchStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'risk'
          ? sessionRisk(s).level !== 'low'
          : s.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q
        || (s.actor_name || '').toLowerCase().includes(q)
        || (s.ip_address || '').toLowerCase().includes(q)
        || (s.user_agent || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [sessions, statusFilter, search]);

  return (
    <div className="page-container space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Session Logs</h1>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-violet-500/10 text-violet-600 border-violet-500/20">
              <Key className="h-2.5 w-2.5" /> Security Layer
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Login sessions, device fingerprints, IP addresses, and authentication events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Days selector */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border/40 rounded-lg p-0.5">
            {DAYS_OPTIONS.map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                  days === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}>
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-[12px]"
            onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Layer info banner */}
      <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 flex items-start gap-3">
        <Shield className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Security monitoring layer</span> — tracks each authentication event: login time,
          device, IP address, and session outcome. Unlike{' '}
          <span className="text-slate-500 font-medium">Audit Logs</span> (all API calls) and{' '}
          <span className="text-blue-500 font-medium">Activity Tracking</span> (behavioral patterns), this focuses specifically on authentication security.
          Use it to detect brute force, session hijacking, and unauthorized access.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Sessions', value: stats.total, icon: LogIn, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Successful', value: stats.success, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Failed Auth', value: stats.failed, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'High Risk', value: stats.highRisk, icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Unique IPs', value: stats.uniqueIPs, icon: Globe, color: 'text-violet-500', bg: 'bg-violet-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: macEase }}>
            <Card className="stat-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0', s.bg)}>
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[18px] font-extrabold leading-none">{isLoading ? '—' : s.value}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Two-col: Filters + IP frequency */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* IP Frequency heatmap */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3, ease: macEase }}>
          <Card className="mac-card">
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[13px] font-bold">Top IP Addresses</span>
            </div>
            <CardContent className="p-3 space-y-2">
              {isLoading ? (
                <div className="space-y-1.5">{[1,2,3,4].map(i=><div key={i} className="skeleton h-6 w-full"/>)}</div>
              ) : ipFrequency.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">No data</p>
              ) : ipFrequency.slice(0, 8).map(({ ip, count }, i) => {
                const maxCount = ipFrequency[0]?.count || 1;
                const failedFromIP = sessions.filter((s: any) => s.ip_address === ip && s.status === 'failed').length;
                const isRisky = failedFromIP >= 2;
                return (
                  <div key={ip} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isRisky && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                        <span className={cn('text-[11px] font-mono font-medium', isRisky && 'text-red-500')}>{ip}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {failedFromIP > 0 && (
                          <span className="text-[9px] text-red-500 font-bold">{failedFromIP} fail</span>
                        )}
                        <span className="text-[11px] font-bold">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', isRisky ? 'bg-red-500/60' : 'bg-violet-500/60')}
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Main session list */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3, ease: macEase }}
          className="lg:col-span-2">
          <Card className="mac-card">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-border/30 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {SESSION_FILTERS.map((f) => (
                  <button key={f.id} onClick={() => setStatusFilter(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all',
                      statusFilter === f.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border/50 text-muted-foreground hover:bg-muted/40'
                    )}>
                    {f.label}
                    {f.id === 'failed' && stats.failed > 0 && (
                      <span className="ml-1 text-[9px] bg-red-500 text-white rounded-full px-1">{stats.failed}</span>
                    )}
                  </button>
                ))}
                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input placeholder="Search user, IP…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="h-7 pl-8 text-[11px] bg-background border-border/50 rounded-lg w-[180px]" />
                </div>
              </div>
            </div>

            {/* Session list */}
            <div className="divide-y divide-border/20">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-[13px] text-muted-foreground">Loading sessions…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <LogIn className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-[12px] text-muted-foreground">No sessions for this filter</p>
                </div>
              ) : filtered.map((session: any, idx: number) => {
                const device = parseDevice(session.user_agent);
                const DeviceIcon = device.icon;
                const ok = session.status === 'success';
                const risk = sessionRisk(session);
                const riskConfig = RISK_CONFIG[risk.level];
                const ts = session.timestamp ? new Date(session.timestamp) : null;
                const timeStr = ts ? format(ts, 'MMM d, HH:mm:ss') : '—';
                const ago = ts ? formatDistanceToNow(ts, { addSuffix: true }) : '';

                return (
                  <div key={session.session_id || idx}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors group">
                    {/* Status icon */}
                    <div className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-xl shrink-0 mt-0.5 border',
                      ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
                    )}>
                      {ok
                        ? <LogIn className="h-4 w-4 text-emerald-500" strokeWidth={1.8} />
                        : <Ban className="h-4 w-4 text-red-500" strokeWidth={1.8} />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[12px] font-bold">
                          {ok ? 'Authenticated' : 'Failed Login'}
                        </span>
                        {/* Role */}
                        {session.user_role && (
                          <span className="text-[9px] font-semibold text-muted-foreground bg-muted/40 border border-border/30 px-1.5 py-0.5 rounded capitalize">
                            {session.user_role}
                          </span>
                        )}
                        {/* Risk badge */}
                        {risk.level !== 'low' && (
                          <span className={cn(
                            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ml-auto',
                            riskConfig.color, riskConfig.bg, riskConfig.border
                          )}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {riskConfig.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {session.actor_name || session.user_id?.slice(0, 12) || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.ip_address || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DeviceIcon className="h-3 w-3" />
                          {device.label}
                        </span>
                        {session.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{session.duration_minutes}m session
                          </span>
                        )}
                      </div>
                      {/* Risk reasons */}
                      {risk.reasons.length > 0 && risk.level !== 'low' && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {risk.reasons.map((r, ri) => (
                            <span key={ri} className="text-[9px] text-orange-600 dark:text-orange-400 bg-orange-500/8 border border-orange-500/15 px-1.5 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-mono text-muted-foreground">{timeStr}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{ago}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t border-border/20 text-[10px] text-muted-foreground/50 text-center">
                {filtered.length} of {sessions.length} sessions shown — last {days} days
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default SessionLogsPage;
