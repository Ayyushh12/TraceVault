/**
 * Dashboard Page — Apple-level clean design
 *
 * Layout:
 *   Header (greeting + date + quick actions)
 *   Integrity Alert banner (if tampered evidence exists)
 *   4 stat cards (fade in staggered)
 *   Main grid:
 *     Left (3/5) — Recent Activity table
 *     Right (2/5):
 *       Evidence Health bar chart
 *       Quick Actions grid (semantic icons)
 *       Cases list
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  FileSearch, Upload, CheckCircle2, FolderOpen, GitBranch,
  Activity, ArrowRight, Clock, TrendingUp, Loader2, User,
  AlertTriangle, Eye, BarChart2, FileText, Users, Zap,
  Hash, Link2, Monitor, ShieldOff, Lock, ChevronRight,
} from 'lucide-react';
import { useDashboardStats, useCases } from '@/hooks/use-api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const ease = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const fmtAgo = (ts: string) => {
  if (!ts) return '—';
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return '—'; }
};

// ── Semantic icon map for audit log actions ───────────────────────
const ACTION_CFG: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  'CREATE:AUTH':     { icon: User,         label: 'User Authenticated',  color: 'text-primary' },
  'CREATE:EVIDENCE': { icon: Upload,        label: 'Evidence Uploaded',   color: 'text-blue-500' },
  'READ:EVIDENCE':   { icon: Eye,           label: 'Evidence Accessed',   color: 'text-slate-500' },
  'READ:CASES':      { icon: FolderOpen,    label: 'Cases Viewed',        color: 'text-slate-500' },
  'CREATE:CASES':    { icon: FolderOpen,    label: 'Case Created',        color: 'text-emerald-500' },
  'READ:AUDIT':      { icon: FileText,      label: 'Audit Log Reviewed',  color: 'text-violet-500' },
  'READ:HEALTH':     { icon: Activity,      label: 'Health Check',        color: 'text-slate-400' },
  'UPDATE:EVIDENCE': { icon: FileSearch,    label: 'Evidence Updated',    color: 'text-amber-500' },
  'DELETE:EVIDENCE': { icon: AlertTriangle, label: 'Evidence Deleted',    color: 'text-red-500' },
  'READ:DASHBOARD':  { icon: BarChart2,     label: 'Dashboard Viewed',    color: 'text-slate-400' },
  'CREATE:CUSTODY':  { icon: Link2,         label: 'Custody Transferred', color: 'text-amber-500' },
  'VERIFY_EVIDENCE': { icon: CheckCircle2,  label: 'Integrity Verified',  color: 'text-emerald-500' },
  'LOCK_EVIDENCE':   { icon: Lock,          label: 'Evidence Locked',     color: 'text-red-500' },
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// ── Quick actions — semantic icons, no repeats ────────────────────
const QUICK_ACTIONS = [
  { label: 'Upload Evidence', icon: Upload,       path: '/upload',  color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  { label: 'Verify Integrity', icon: CheckCircle2, path: '/verify',  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Evidence List',   icon: FileSearch,   path: '/evidence', color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'Chain of Custody', icon: Link2,        path: '/custody', color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  { label: 'Reports',         icon: FileText,     path: '/reports', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Audit Logs',      icon: FileText,     path: '/audit-logs', color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const { data: casesData, isLoading: casesLoading } = useCases({ limit: 5 });

  const stats = useMemo(() => {
    if (!statsData) return {
      totalEvidence: 0, verified: 0, pending: 0, tampered: 0,
      totalCases: 0, openCases: 0, closedCases: 0, investigatingCases: 0,
      totalAudit: 0, todayAudit: 0, totalUsers: 0, todayUploads: 0, weeklyUploads: 0,
    };
    return {
      totalEvidence:      statsData.evidence?.total           || 0,
      verified:           statsData.evidence?.verified         || 0,
      pending:            statsData.evidence?.pending           || 0,
      tampered:           statsData.evidence?.tampered          || 0,
      todayUploads:       statsData.evidence?.today_uploads     || 0,
      weeklyUploads:      statsData.evidence?.weekly_uploads    || 0,
      totalCases:         statsData.cases?.total               || 0,
      openCases:          statsData.cases?.open                 || 0,
      closedCases:        statsData.cases?.closed               || 0,
      investigatingCases: statsData.cases?.investigating        || 0,
      totalAudit:         statsData.audit?.total               || 0,
      todayAudit:         statsData.audit?.today                || 0,
      totalUsers:         statsData.users?.total               || 0,
    };
  }, [statsData]);

  const auditLogs = useMemo(() => statsData?.recent_activity || [], [statsData]);
  const cases = useMemo(() => {
    const list = casesData?.cases || casesData?.data?.cases || (Array.isArray(casesData) ? casesData : []);
    return Array.isArray(list) ? list : [];
  }, [casesData]);

  return (
    <div className="page-container space-y-5 pb-8">

      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Investigator'}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {stats.todayUploads > 0 && (
              <span className="ml-2 text-primary font-semibold">· {stats.todayUploads} upload{stats.todayUploads !== 1 ? 's' : ''} today</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 text-[12px]" onClick={() => navigate('/upload')}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Evidence
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => navigate('/cases')}>
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> New Case
          </Button>
        </div>
      </motion.div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Evidence', value: stats.totalEvidence, icon: FileSearch,    color: 'text-primary',      bg: 'bg-primary/10',      sub: stats.weeklyUploads > 0 ? `+${stats.weeklyUploads} this week` : null },
          { label: 'Verified',       value: stats.verified,      icon: CheckCircle2,  color: 'text-emerald-500',  bg: 'bg-emerald-500/10',  sub: stats.totalEvidence > 0 ? `${Math.round(stats.verified / stats.totalEvidence * 100)}% rate` : null },
          { label: 'Active Cases',   value: stats.openCases,     icon: FolderOpen,    color: 'text-amber-500',    bg: 'bg-amber-500/10',    sub: stats.investigatingCases > 0 ? `${stats.investigatingCases} investigating` : null },
          { label: 'Audit Events',   value: stats.totalAudit,    icon: Activity,      color: 'text-violet-500',   bg: 'bg-violet-500/10',   sub: stats.todayAudit > 0 ? `${stats.todayAudit} today` : null },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.22, ease }}>
            <Card className="mac-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl', s.bg)}>
                    <s.icon className={cn('h-4 w-4', s.color)} strokeWidth={1.6} />
                  </div>
                </div>
                <p className="text-[24px] font-extrabold tracking-tight leading-none">
                  {statsLoading ? <span className="skeleton inline-block h-7 w-10" /> : s.value}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">{s.label}</p>
                {s.sub && !statsLoading && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" /> {s.sub}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Tampered alert — subtle, no shield ──────────────────── */}
      {stats.tampered > 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25, ease }}>
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-bold text-red-600 dark:text-red-400">Integrity Alert — </span>
              <span className="text-[12px] text-muted-foreground">
                {stats.tampered} evidence item{stats.tampered > 1 ? 's' : ''} flagged with hash mismatch. Immediate review required.
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
              onClick={() => navigate('/evidence')}>
              Review <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Main 5-col grid ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Recent Activity — 3 cols */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.25, ease }} className="lg:col-span-3">
          <Card className="mac-card h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
              <h2 className="text-[13px] font-bold flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                Recent Activity
              </h2>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground"
                onClick={() => navigate('/audit-logs')}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-border/20">
              {statsLoading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-[12px] text-muted-foreground">Loading…</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-5 w-5 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-[12px] text-muted-foreground">No recent activity</p>
                </div>
              ) : auditLogs.slice(0, 8).map((log: any, idx: number) => {
                const cfg = ACTION_CFG[log.action] || { icon: Activity, label: log.action?.replace(/:/g, ' › ') || 'Activity', color: 'text-muted-foreground' };
                const Icon = cfg.icon;
                return (
                  <div key={log._id || idx}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted/40 shrink-0">
                      <Icon className={cn('h-3.5 w-3.5', cfg.color)} strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate">{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {log.actor_name || (log.user_id ? 'User ' + log.user_id.slice(0, 6) : 'System')}
                        {log.endpoint && <span className="font-mono ml-1 opacity-60">{log.endpoint}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.status_code && (
                        <span className={cn('inline-flex items-center h-4 px-1.5 rounded text-[9px] font-bold border',
                          (log.status_code) < 300 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' :
                          (log.status_code) < 400 ? 'bg-amber-500/10 text-amber-600 border-amber-500/25' :
                          'bg-red-500/10 text-red-600 border-red-500/25')}>
                          {log.status_code}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
                        {fmtAgo(log.timestamp || log.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Right column — 2 cols */}
        <div className="lg:col-span-2 space-y-4">

          {/* Evidence Health */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.25, ease }}>
            <Card className="mac-card">
              <div className="flex items-center px-4 py-3 border-b border-border/25 gap-2">
                <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <h2 className="text-[13px] font-bold">Evidence Health</h2>
              </div>
              <CardContent className="p-4 space-y-3">
                {statsLoading ? (
                  [1,2,3].map(i => <div key={i} className="skeleton h-8 w-full" />)
                ) : stats.totalEvidence === 0 ? (
                  <div className="text-center py-4">
                    <FileSearch className="h-5 w-5 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-[12px] text-muted-foreground">No evidence yet</p>
                  </div>
                ) : [
                  { label: 'Verified',  value: stats.verified, color: 'bg-emerald-500', text: 'text-emerald-500' },
                  { label: 'Pending',   value: stats.pending,  color: 'bg-amber-500',   text: 'text-amber-500' },
                  { label: 'Tampered',  value: stats.tampered, color: 'bg-red-500',     text: 'text-red-500' },
                ].map(bar => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">{bar.label}</span>
                      <span className={cn('text-[11px] font-bold', bar.text)}>{bar.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div className={cn('h-full rounded-full', bar.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.totalEvidence > 0 ? (bar.value / stats.totalEvidence * 100) : 0}%` }}
                        transition={{ duration: 0.5, delay: 0.3 }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.29, duration: 0.25, ease }}>
            <Card className="mac-card">
              <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <h2 className="text-[13px] font-bold">Quick Actions</h2>
              </div>
              <CardContent className="p-3 grid grid-cols-2 gap-1.5">
                {QUICK_ACTIONS.map(item => (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left group mac-press">
                    <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0', item.bg)}>
                      <item.icon className={cn('h-3.5 w-3.5', item.color)} strokeWidth={1.7} />
                    </div>
                    <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Cases */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.25, ease }}>
            <Card className="mac-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
                <h2 className="text-[13px] font-bold flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                  Cases
                </h2>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground"
                  onClick={() => navigate('/cases')}>
                  View All <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
              <CardContent className="p-2 space-y-0.5">
                {casesLoading ? (
                  [1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)
                ) : cases.length === 0 ? (
                  <div className="text-center py-5">
                    <FolderOpen className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
                    <p className="text-[12px] text-muted-foreground">No cases created</p>
                  </div>
                ) : cases.slice(0, 4).map((c: any, i: number) => {
                  const st = (c.status || 'open').toLowerCase();
                  const statusCls = st === 'closed'
                    ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                    : st === 'open' || st === 'active'
                      ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-amber-600 bg-amber-500/10 border-amber-500/20';
                  return (
                    <div key={c.case_id || i}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate('/cases')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate">{c.case_name || c.title || 'Untitled'}</p>
                        <p className="text-[10px] text-muted-foreground/60">{fmtAgo(c.created_at)}</p>
                      </div>
                      <Badge variant="outline" className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shrink-0 border', statusCls)}>
                        {c.status || 'open'}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Team */}
          {stats.totalUsers > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.25, ease }}>
              <Card className="mac-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-blue-500/10">
                      <Users className="h-4 w-4 text-blue-500" strokeWidth={1.6} />
                    </div>
                    <div>
                      <p className="text-[18px] font-extrabold leading-none">{stats.totalUsers}</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Team Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
