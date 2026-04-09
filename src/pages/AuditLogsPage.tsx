/**
 * Audit Logs Page — Enterprise-grade, clean Apple design
 *
 * Layout:
 *   Header + stats row (4 cards)
 *   Filter bar (search + filters)
 *   Log table — icon + action + user + HTTP code + IP + time
 *   Pagination
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, Download, RefreshCw, Filter, ChevronLeft, ChevronRight,
  AlertTriangle, Activity, User, FileText, Upload, Eye, FolderOpen,
  CheckCircle2, XCircle, AlertCircle, Info, X, Hash, Link2,
  Terminal, Globe, Laptop, Smartphone, ChevronDown, Lock,
} from 'lucide-react';
import { useAuditLogs } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

const ease = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Action config — semantic icon per action ─────────────────────
const ACTION_CFG: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  'CREATE:AUTH':     { icon: User,         label: 'Authentication',    color: 'text-primary' },
  'CREATE:LOGIN':    { icon: User,         label: 'Login',             color: 'text-primary' },
  'CREATE:EVIDENCE': { icon: Upload,        label: 'Evidence Upload',   color: 'text-blue-500' },
  'READ:EVIDENCE':   { icon: Eye,           label: 'Evidence Access',   color: 'text-slate-500' },
  'UPDATE:EVIDENCE': { icon: FileText,      label: 'Evidence Updated',  color: 'text-amber-500' },
  'DELETE:EVIDENCE': { icon: AlertTriangle, label: 'Evidence Deleted',  color: 'text-red-500' },
  'READ:CASES':      { icon: FolderOpen,    label: 'Cases Viewed',      color: 'text-slate-500' },
  'CREATE:CASES':    { icon: FolderOpen,    label: 'Case Created',      color: 'text-emerald-500' },
  'READ:AUDIT':      { icon: FileText,      label: 'Audit Access',      color: 'text-violet-500' },
  'READ:HEALTH':     { icon: Activity,      label: 'Health Check',      color: 'text-muted-foreground' },
  'READ:USERS':      { icon: User,          label: 'Users Viewed',      color: 'text-slate-500' },
  'UPDATE:USERS':    { icon: User,          label: 'User Updated',      color: 'text-amber-500' },
  'CREATE:USERS':    { icon: User,          label: 'User Created',      color: 'text-emerald-500' },
  'READ:DASHBOARD':  { icon: Activity,      label: 'Dashboard',         color: 'text-muted-foreground' },
  'CREATE:CUSTODY':  { icon: Link2,         label: 'Custody Transfer',  color: 'text-amber-500' },
  'VERIFY_EVIDENCE': { icon: CheckCircle2,  label: 'Integrity Verify',  color: 'text-emerald-500' },
  'LOCK_EVIDENCE':   { icon: Lock,          label: 'Evidence Locked',   color: 'text-red-500' },
};

// ── Status code badge ────────────────────────────────────────────
const getSeverity = (log: any) => {
  const code = log.status_code || 200;
  if (code >= 500) return 'critical';
  if (code >= 400) return 'error';
  if (log.action?.includes('DELETE')) return 'warning';
  return 'success';
};

const SEV_CFG = {
  success:  { icon: CheckCircle2,  text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
  warning:  { icon: AlertCircle,    text: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-500/8',   border: 'border-amber-500/20' },
  error:    { icon: XCircle,        text: 'text-red-600 dark:text-red-400',        bg: 'bg-red-500/8',     border: 'border-red-500/20' },
  critical: { icon: AlertTriangle,  text: 'text-red-700 dark:text-red-300',        bg: 'bg-red-700/8',     border: 'border-red-700/25' },
  info:     { icon: Info,           text: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-500/8',    border: 'border-blue-500/20' },
};

const formatTs = (ts: string) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const ago = formatDistanceToNow(d, { addSuffix: true });
    const abs = format(d, 'MMM d, HH:mm');
    return { ago, abs };
  } catch { return { ago: '—', abs: '—' }; }
};

const AuditLogsPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const limit = 50;

  const { data, isLoading, isFetching, refetch } = useAuditLogs({ page, limit });

  const logs = useMemo(() => {
    const list = data?.logs || data?.data?.logs || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list : [];
  }, [data]);

  const totalCount = data?.total || data?.data?.total || logs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  // Summary stats
  const stats = useMemo(() => ({
    total:    logs.length,
    errors:   logs.filter((l: any) => (l.status_code || 200) >= 400).length,
    warnings: logs.filter((l: any) => l.action?.includes('DELETE')).length,
    success:  logs.filter((l: any) => (l.status_code || 200) < 300 && !l.action?.includes('DELETE')).length,
  }), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (
        (log.actor_name || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.ip_address || '').includes(q) ||
        (log.endpoint || '').toLowerCase().includes(q)
      );
      const sev = getSeverity(log);
      const matchSev = severityFilter === 'all' || sev === severityFilter;
      const matchAction = actionFilter === 'all' || (log.action || '') === actionFilter;
      return matchSearch && matchSev && matchAction;
    });
  }, [logs, search, severityFilter, actionFilter]);

  const uniqueActions = useMemo(() => [...new Set(logs.map((l: any) => l.action).filter(Boolean))], [logs]);

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Action', 'User', 'IP', 'Status', 'Endpoint'],
      ...filtered.map((l: any) => [
        l.timestamp || l.created_at || '',
        l.action || '',
        l.actor_name || '',
        l.ip_address || '',
        l.status_code || '',
        l.endpoint || '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container space-y-5 pb-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Audit Logs</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Immutable record of all system events · {totalCount.toLocaleString()} total entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.22, ease }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: stats.total,    icon: Activity,      color: 'text-primary',     bg: 'bg-primary/10' },
          { label: 'Successful',   value: stats.success,  icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Warnings',     value: stats.warnings, icon: AlertCircle,   color: 'text-amber-500',   bg: 'bg-amber-500/10' },
          { label: 'Errors',       value: stats.errors,   icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.04, ease }}>
            <Card className="mac-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl shrink-0', s.bg)}>
                  <s.icon className={cn('h-4 w-4', s.color)} strokeWidth={1.7} />
                </div>
                <div>
                  <p className="text-[20px] font-extrabold leading-none">{isLoading ? '…' : s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter bar */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, ease }}>
        <Card className="mac-card">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Search by user, action, IP, endpoint…"
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="h-8 pl-8 text-[12px] bg-muted/30 border-border/40 rounded-lg focus-visible:ring-1"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
                className="h-8 px-2.5 text-[12px] rounded-lg border border-border/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="all">All Severity</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>

              {/* Action filter */}
              <select
                value={actionFilter}
                onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="h-8 px-2.5 text-[12px] rounded-lg border border-border/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                style={{ maxWidth: 180 }}
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((a: string) => (
                  <option key={a} value={a}>{ACTION_CFG[a]?.label || a}</option>
                ))}
              </select>

              {(search || severityFilter !== 'all' || actionFilter !== 'all') && (
                <Button variant="ghost" size="sm" className="h-8 text-[11px]"
                  onClick={() => { setSearch(''); setSeverityFilter('all'); setActionFilter('all'); setPage(1); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}

              <div className="ml-auto text-[11px] text-muted-foreground self-center">
                {filtered.length} of {logs.length}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Log table */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, ease }}>
        <Card className="mac-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
               <span className="text-[12px] font-bold">Event Feed</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60">{filtered.length} entries matching criteria</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/15">
            {isLoading ? (
              <div className="flex items-center justify-center py-14 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">Loading entries…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground/25 mb-2" />
                <p className="text-[13px] text-muted-foreground">No log entries found</p>
              </div>
            ) : filtered.map((log: any, idx: number) => {
              const cfg = ACTION_CFG[log.action] || { icon: Activity, label: log.action?.replace(/[_:]/g, ' ') || 'Event', color: 'text-muted-foreground' };
              const Icon = cfg.icon;
              const sev = getSeverity(log);
              const sevCfg = SEV_CFG[sev] || SEV_CFG.info;
              const ts = formatTs(log.timestamp || log.created_at);

              return (
                <div key={log._id || idx}
                  className="flex flex-col px-4 py-3 hover:bg-muted/15 transition-colors cursor-pointer group border-b border-border/10 last:border-b-0"
                  onClick={() => setExpandedLog(expandedLog === (log._id || idx.toString()) ? null : (log._id || idx.toString()))}>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">

                  {/* Icon & Details */}
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0', sevCfg.bg)}>
                      <Icon className={cn('h-4 w-4', sevCfg.text)} strokeWidth={1.8} />
                    </div>
                    
                    <div className="flex-[1.5] min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[12px] font-bold truncate">{cfg.label}</p>
                        {log.status_code && (
                           <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', sevCfg.text, sevCfg.bg, sevCfg.border)}>
                             {log.status_code}
                           </span>
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground/80 truncate">
                        {log.actor_name || 'System'} {log.role && <span className="opacity-60 capitalize">({log.role})</span>}
                      </p>
                      {log.endpoint && (
                        <p className="font-mono text-[9px] text-muted-foreground/50 truncate mt-0.5">{log.endpoint}</p>
                      )}
                    </div>

                    <div className="hidden md:block flex-1 min-w-0 px-4">
                      {log.ip_address && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 w-fit px-2 py-0.5 rounded-md border border-border/40">
                           <Globe className="h-3 w-3 opacity-50" />
                           <span className="font-mono truncate">{log.ip_address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0 pl-11 sm:pl-0">
                    <p className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                      {typeof ts === 'object' ? ts.ago : ts}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50 whitespace-nowrap mt-0.5 font-mono">
                      {typeof ts === 'object' ? ts.abs : ''}
                    </p>
                  </div>
                  </div>

                  {/* Expanded detail row */}
                  {expandedLog === (log._id || idx.toString()) && (
                    <div className="w-full mt-3 sm:pl-[44px]">
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/30 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                        {log.user_id && <div><span className="text-muted-foreground mb-0.5 block">User ID</span><span className="font-mono font-medium truncate w-full block">{log.user_id}</span></div>}
                        {log.method && <div><span className="text-muted-foreground mb-0.5 block">Method</span><span className="font-bold max-w-full truncate block">{log.method}</span></div>}
                        {log.device_fingerprint && <div><span className="text-muted-foreground mb-0.5 block">Device Fingerprint</span><span className="font-mono text-primary truncate max-w-full block" title={log.device_fingerprint}>{log.device_fingerprint}</span></div>}
                        {log.mac_address && <div><span className="text-muted-foreground mb-0.5 block">Hardware MAC</span><span className="font-mono text-emerald-500 font-medium truncate max-w-full block">{log.mac_address}</span></div>}
                        {log.response_time_ms && <div><span className="text-muted-foreground mb-0.5 block">Response Time</span><span className="font-medium max-w-full truncate block">{log.response_time_ms}ms</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/20 bg-muted/10">
              <p className="text-[11px] text-muted-foreground">
                Page {page} of {totalPages} · {totalCount.toLocaleString()} events
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono px-2">{page}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default AuditLogsPage;
