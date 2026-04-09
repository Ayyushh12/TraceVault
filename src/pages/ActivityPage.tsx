/**
 * Activity Tracking Page — with Session Logs tab (merged)
 *
 * Tabs:
 *   Overview   — heatmap + behavior analytics
 *   Session Log — shows login/session events (replaces old SessionLogsPage)
 *   Risk Events — high-risk activity feed
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, User, Globe, Laptop, Smartphone,
  RefreshCw, Download, BarChart2, TrendingUp, AlertTriangle,
  Monitor, Hash, LogIn, LogOut, Bot, Shield, AlertCircle,
  CheckCircle2, ChevronRight, XCircle,
} from 'lucide-react';
import { useAuditLogs, useAuditAnalytics } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, subDays } from 'date-fns';

const ease = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Helpers ───────────────────────────────────────────────────────
const parseDevice = (ua: string = '') => {
  if (!ua) return { icon: Monitor, label: 'Unknown' };
  const u = ua.toLowerCase();
  if (u.includes('bot') || u.includes('crawl') || u.includes('spider')) return { icon: Bot, label: 'Bot' };
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone')) return { icon: Smartphone, label: 'Mobile' };
  if (u.includes('curl') || u.includes('python') || u.includes('axios')) return { icon: Hash, label: 'API' };
  return { icon: Laptop, label: 'Desktop' };
};

const actionLabel = (action: string) => {
  const map: Record<string, string> = {
    'CREATE:AUTH': 'Sign In', 'CREATE:EVIDENCE': 'Upload', 'READ:EVIDENCE': 'View Evidence',
    'READ:CASES': 'View Case', 'CREATE:CASES': 'Create Case', 'READ:AUDIT': 'View Audit',
    'READ:HEALTH': 'Health Check', 'UPDATE:EVIDENCE': 'Update Evidence', 'DELETE:EVIDENCE': 'Delete Evidence',
    'READ:USERS': 'View Users', 'UPDATE:USERS': 'Update User', 'CREATE:USERS': 'Create User',
    'RISK_DETECTED': 'Forensic Alert', 'evidence_verify': 'Verify Integrity',
  };
  return map[action] || action?.replace(/[_:]/g, ' ') || 'System';
};

const isHighRisk = (log: any) => {
  const action = log.action || '';
  if (action === 'RISK_DETECTED') return true;
  if (log.request_body?.risk_type === 'TAMPERING') return true;
  if ([401, 403, 405].includes(log.status_code)) return true;
  if (action.includes('DELETE')) return true;
  
  const hour = new Date(log.timestamp || log.created_at || 0).getHours();
  if (hour < 6 || hour > 22) return true;
  
  return false;
};

// ── Heatmap ───────────────────────────────────────────────────────
const WEEK_COUNT = 26;

function buildCalendar(counts: Record<string, number>) {
  const today = new Date();
  const cols: { date: Date; count: number; key: string }[][] = [];
  for (let w = WEEK_COUNT - 1; w >= 0; w--) {
    const col: { date: Date; count: number; key: string }[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(today.getDate() - w * 7 - d);
      const key = date.toISOString().split('T')[0];
      col.push({ date, count: counts[key] || 0, key });
    }
    cols.push(col);
  }
  return cols;
}

function heatColor(count: number, max: number) {
  if (count === 0) return 'bg-muted/40';
  const r = count / (max || 1);
  if (r > 0.75) return 'bg-primary';
  if (r > 0.4)  return 'bg-primary/60';
  if (r > 0.1)  return 'bg-primary/30';
  return 'bg-primary/15';
}

const DAYS = ['S','M','T','W','T','F','S'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Tabs ────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',    icon: BarChart2 },
  { id: 'sessions',  label: 'Session Logs',icon: LogIn },
  { id: 'risk',      label: 'Risk Events', icon: AlertCircle },
];

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'risk'>('overview');
  const [timeFilter, setTimeFilter] = useState<'7d'|'30d'|'90d'|'all'>('30d');

  // Fetch latest logs for feed views (limit 500 satisfies max backend validation)
  const { data: logData, isLoading, refetch, isFetching } = useAuditLogs({ limit: 500 });

  const allLogs: any[] = useMemo(() => {
    const list = logData?.logs || logData?.data?.logs || (Array.isArray(logData) ? logData : []);
    return Array.isArray(list) ? list : [];
  }, [logData]);

  const cutoff = useMemo(() => {
    if (timeFilter === 'all') return new Date(0);
    const d = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
    return subDays(new Date(), d);
  }, [timeFilter]);

  const logs = useMemo(() =>
    allLogs.filter(l => new Date(l.timestamp || l.created_at || 0) >= cutoff),
    [allLogs, cutoff]
  );

  const { data: analyticsData, isLoading: analyticsLoading } = useAuditAnalytics({
    days: timeFilter === 'all' ? 365 : timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90
  });

  const analytics = useMemo(() => {
    if (!analyticsData) return { topUsers: [], topActions: [], hourMap: Array(24).fill(0), maxHour: 1, calendar: buildCalendar({}), calMax: 1, peakHour: 0, dayCounts: {} };
    
    return {
      topUsers: analyticsData.topUsers || [],
      topActions: analyticsData.topActions || [],
      hourMap: analyticsData.hourMap || Array(24).fill(0),
      maxHour: analyticsData.maxHour || 1,
      peakHour: analyticsData.peakHour || 0,
      calMax: analyticsData.calMax || 1,
      calendar: buildCalendar(analyticsData.dayCounts || {}),
      dayCounts: analyticsData.dayCounts || {}
    };
  }, [analyticsData]);

  // Session logs = login/auth events
  const sessionLogs = useMemo(() =>
    allLogs.filter((l: any) =>
      l.action?.includes('AUTH') || l.action?.includes('LOGIN') || l.action?.includes('LOGOUT')
    ).slice(0, 100),
    [allLogs]
  );

  // Risk events
  const riskEvents = useMemo(() =>
    logs.filter(isHighRisk).slice(0, 100),
    [logs]
  );

  return (
    <div className="page-container space-y-5 pb-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Activity Tracking</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Behavioral analytics · Session logs · Risk event feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['7d','30d','90d','all'].map(f => (
            <button key={f}
              onClick={() => setTimeFilter(f as any)}
              className={cn('h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors',
                timeFilter === f
                  ? 'bg-primary text-white'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground')}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3 w-3 mr-1', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </motion.div>

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, ease }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: logData?.pagination?.total || logData?.total || logs.length, icon: Activity,     color: 'text-primary',      bg: 'bg-primary/10' },
          { label: 'Active Users', value: analytics.topUsers.length, icon: User,        color: 'text-blue-500',     bg: 'bg-blue-500/10' },
          { label: 'Risk Events',  value: riskEvents.length,         icon: AlertCircle, color: 'text-red-500',      bg: 'bg-red-500/10' },
          { label: 'Peak Hour',    value: `${analytics.peakHour}:00`, icon: Clock,      color: 'text-amber-500',    bg: 'bg-amber-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.04, ease }}>
            <Card className="mac-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl shrink-0', s.bg)}>
                  <s.icon className={cn('h-4 w-4', s.color)} strokeWidth={1.7} />
                </div>
                <div>
                  <p className="text-[20px] font-extrabold leading-none">{(isLoading || analyticsLoading) ? '…' : s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tab bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.12, ease }}>
        <div className="flex gap-0.5 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground')}>
              <tab.icon className="h-3.5 w-3.5" strokeWidth={1.7} />
              {tab.label}
              {tab.id === 'risk' && riskEvents.length > 0 && (
                <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {riskEvents.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }}
            className="space-y-4">

            {/* Activity heatmap */}
            <Card className="mac-card">
              <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Activity Heatmap</span>
                <span className="text-[10px] text-muted-foreground/60">Last 6 months</span>
              </div>
              <CardContent className="p-4 overflow-x-auto">
                <div className="flex gap-0.5">
                  {/* Day labels */}
                  <div className="flex flex-col gap-0.5 mr-1.5 justify-around pt-4">
                    {DAYS.map((d, i) => (
                      <span key={i} className="text-[9px] text-muted-foreground/50 h-[12px] leading-[12px] text-right pr-0.5">
                        {i % 2 === 1 ? d : ''}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    {/* Month labels */}
                    <div className="flex gap-0.5 mb-0.5 h-4">
                      {analytics.calendar.map((col, ci) => {
                        const m = col[0]?.date;
                        const isFirst = ci === 0 || m?.getDate() <= 7;
                        return (
                          <div key={ci} className="w-3 shrink-0">
                            {isFirst && m && ci > 0 ? (
                              <span className="text-[8px] text-muted-foreground/40 whitespace-nowrap">
                                {MONTHS[m.getMonth()]}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {/* Grid */}
                    <div className="flex gap-0.5">
                      {analytics.calendar.map((col, ci) => (
                        <div key={ci} className="flex flex-col gap-0.5">
                          {col.map((cell) => (
                            <div key={cell.key}
                              title={`${cell.key}: ${cell.count} events`}
                              className={cn('h-3 w-3 rounded-[2px] transition-colors', heatColor(cell.count, analytics.calMax))}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2-col: Top users + Top actions */}
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="mac-card">
                <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                  <span className="text-[12px] font-bold">Most Active Users</span>
                </div>
                <div className="divide-y divide-border/15">
                  {analytics.topUsers.map(([uid, info], i) => {
                    const pct = analytics.topUsers[0] ? (info.count / analytics.topUsers[0][1].count * 100) : 0;
                    return (
                      <div key={uid} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] text-muted-foreground/40 w-4 text-right shrink-0">#{i + 1}</span>
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 shrink-0">
                          <User className="h-3 w-3 text-primary" strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-semibold truncate">{info.name}</span>
                            <span className="text-[11px] font-bold ml-2 shrink-0">{info.count}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                            <motion.div className="h-full rounded-full bg-primary/50"
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, delay: i * 0.03 }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {analytics.topUsers.length === 0 && (
                    <div className="py-8 text-center text-[12px] text-muted-foreground">No data</div>
                  )}
                </div>
              </Card>

              <Card className="mac-card">
                <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                  <span className="text-[12px] font-bold">Top Actions</span>
                </div>
                <div className="divide-y divide-border/15">
                  {analytics.topActions.map(([action, count], i) => {
                    const pct = analytics.topActions[0] ? (count / (analytics.topActions[0][1] as number) * 100) : 0;
                    return (
                      <div key={action} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] text-muted-foreground/40 w-4 text-right shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-semibold truncate">{actionLabel(action)}</span>
                            <span className="text-[11px] font-bold ml-2 shrink-0">{count}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                            <motion.div className="h-full rounded-full bg-violet-500/50"
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, delay: i * 0.03 }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Hour of day bar chart */}
            <Card className="mac-card">
              <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Hourly Activity Pattern</span>
                <span className="text-[10px] text-muted-foreground/60 ml-auto">
                  Peak: {analytics.peakHour}:00 ({analytics.hourMap[analytics.peakHour]} events)
                </span>
              </div>
              <CardContent className="p-4">
                <div className="flex items-end gap-0.5 h-16">
                  {analytics.hourMap.map((count, h) => {
                    const pct = analytics.maxHour > 0 ? (count / analytics.maxHour * 100) : 0;
                    const isOff = h < 6 || h > 22;
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1 group"
                        title={`${h}:00 — ${count} events`}>
                        <div className="w-full flex items-end" style={{ height: 48 }}>
                          <motion.div
                            className={cn('w-full rounded-t-sm', isOff ? 'bg-red-500/40' : 'bg-primary/40',
                              'group-hover:opacity-100 opacity-80 transition-opacity')}
                            initial={{ height: 0 }} animate={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                            style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                            transition={{ duration: 0.4, delay: h * 0.01 }}
                          />
                        </div>
                        {h % 6 === 0 && (
                          <span className="text-[8px] text-muted-foreground/40">{h}h</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-2">
                  <span className="inline-block h-2 w-2 rounded-sm bg-red-500/40 mr-1" />
                  Red bars = off-hours (00–06, 22–24)
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Session Logs tab ── */}
        {activeTab === 'sessions' && (
          <motion.div key="sessions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }}>
            <Card className="mac-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                <LogIn className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Session Log</span>
                <span className="text-[10px] text-muted-foreground/60">{sessionLogs.length} auth events</span>
              </div>
              <div className="divide-y divide-border/15">
                {sessionLogs.length === 0 ? (
                  <div className="py-12 text-center">
                    <LogIn className="h-5 w-5 mx-auto text-muted-foreground/25 mb-2" />
                    <p className="text-[12px] text-muted-foreground">No session events recorded</p>
                  </div>
                ) : sessionLogs.map((log: any, i: number) => {
                  const isLogin = log.action?.includes('AUTH') || log.action?.includes('LOGIN');
                  const success = (log.status_code || 200) < 400;
                  const dv = parseDevice(log.user_agent || '');
                  const DevIcon = dv.icon;

                  return (
                    <div key={log._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/15">
                      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0',
                        success ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                        {success
                          ? <LogIn className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.8} />
                          : <XCircle className="h-3.5 w-3.5 text-red-500" strokeWidth={1.8} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold">{log.actor_name || 'Unknown'}</p>
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
                            success ? 'text-emerald-600 bg-emerald-500/8 border-emerald-500/20' : 'text-red-600 bg-red-500/8 border-red-500/20')}>
                            {success ? 'OK' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{log.ip_address || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                          <DevIcon className="h-3 w-3" strokeWidth={1.6} />
                          <span>{dv.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/50">
                          {log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }) : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Risk Events tab ── */}
        {activeTab === 'risk' && (
          <motion.div key="risk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }}>
            <Card className="mac-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Risk Events</span>
                <Badge variant="outline" className="text-[9px] font-bold text-red-600 border-red-500/25 bg-red-500/8">
                  {riskEvents.length} flagged
                </Badge>
                <span className="text-[10px] text-muted-foreground/60 ml-1">forensic alerts · errors · deletes · off-hours</span>
              </div>
              <div className="divide-y divide-border/15">
                {riskEvents.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500/40 mb-2" />
                    <p className="text-[12px] text-muted-foreground">No risk events in this period</p>
                  </div>
                ) : riskEvents.slice(0, 50).map((log: any, i: number) => {
                  const hour = new Date(log.timestamp || log.created_at || 0).getHours();
                  const isOffHours = hour < 6 || hour > 22;
                  const isError = [401, 403, 405].includes(log.status_code);
                  const isDelete = log.action?.includes('DELETE');

                  const riskType = log.action === 'RISK_DETECTED' ? { label: 'Forensic', color: 'text-violet-500', bg: 'bg-violet-500/8', border: 'border-violet-500/20' }
                    : isDelete ? { label: 'Delete', color: 'text-red-500', bg: 'bg-red-500/8', border: 'border-red-500/20' }
                    : isError ? { label: 'Error', color: 'text-orange-500', bg: 'bg-orange-500/8', border: 'border-orange-500/20' }
                    : { label: 'Off-Hours', color: 'text-amber-500', bg: 'bg-amber-500/8', border: 'border-amber-500/20' };

                  return (
                    <div key={log._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/15">
                      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0', riskType.bg)}>
                        <AlertTriangle className={cn('h-3.5 w-3.5', riskType.color)} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[12px] font-semibold">{actionLabel(log.action || '')}</p>
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', riskType.color, riskType.bg, riskType.border)}>
                            {riskType.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {log.actor_name || 'Unknown'} · {log.ip_address || '—'}
                        </p>
                        {log.action === 'RISK_DETECTED' && log.request_body && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {log.request_body.risk_type && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                                {log.request_body.risk_type.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {log.request_body.entropy !== undefined && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20 font-mono">
                                Entropy: {Number(log.request_body.entropy).toFixed(4)}
                              </Badge>
                            )}
                            {log.request_body.signature_match === false && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                                Signature Spoofed
                              </Badge>
                            )}
                            {log.request_body.label && (
                              <p className="text-[9px] text-muted-foreground italic w-full mt-0.5 border-l-2 border-red-500/30 pl-1.5">
                                "{log.request_body.label}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground/60">
                          {log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }) : '—'}
                        </p>
                        {log.status_code && (
                          <span className="text-[9px] font-mono text-muted-foreground/40">{log.status_code}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
