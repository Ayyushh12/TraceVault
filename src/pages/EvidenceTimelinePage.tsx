/**
 * Evidence Timeline — Operational Layer
 *
 * NOT the Chain of Custody (Legal) and NOT Audit Logs (System).
 * Purpose: Show the complete operational lifecycle of evidence items.
 *
 * Includes: uploads, edits, tagging, viewing, processing, analysis
 * - Editable annotations (unlike custody chain)
 * - Filter by evidence item, action type, date, user
 * - Rich per-action icons and event grouping
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Search, Upload, Eye, Edit3, Trash2, Tag, FileSearch,
  Loader2, Filter, X, RefreshCw, BarChart2, FileText, Activity,
  ChevronDown, Download, ShieldCheck, User, Calendar, Layers,
  Microscope, ArrowUpDown, CheckCircle2, AlertCircle, Info
} from 'lucide-react';
import { useEvidenceTimelineFeed, useEvidenceTimelineSummary } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// Operational action configs — evidence lifecycle actions
const ACTION_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string; border: string; category: string }> = {
  'CREATE:EVIDENCE':   { label: 'Evidence Uploaded',   icon: Upload,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', category: 'ingest' },
  'READ:EVIDENCE':     { label: 'Evidence Accessed',   icon: Eye,         color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    category: 'access' },
  'UPDATE:EVIDENCE':   { label: 'Evidence Modified',   icon: Edit3,       color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   category: 'modify' },
  'DELETE:EVIDENCE':   { label: 'Evidence Deleted',    icon: Trash2,      color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',     border: 'border-red-500/20',     category: 'delete' },
  'evidence_upload':   { label: 'Evidence Uploaded',   icon: Upload,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', category: 'ingest' },
  'evidence_verify':   { label: 'Integrity Checked',   icon: ShieldCheck, color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    category: 'verify' },
  'evidence_access':   { label: 'Accessed for Analysis', icon: Microscope, color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  category: 'access' },
  'evidence_download': { label: 'Evidence Downloaded', icon: Download,    color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  category: 'export' },
};

const defaultAction = { label: 'Evidence Event', icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-border', category: 'other' };

const CATEGORIES = [
  { id: 'all',    label: 'All Events',    icon: Layers },
  { id: 'ingest', label: 'Uploads',       icon: Upload },
  { id: 'access', label: 'Access',        icon: Eye },
  { id: 'modify', label: 'Edits',         icon: Edit3 },
  { id: 'verify', label: 'Verifications', icon: ShieldCheck },
  { id: 'export', label: 'Exports',       icon: Download },
  { id: 'delete', label: 'Deletions',     icon: Trash2 },
];

function groupByDate(events: any[]) {
  const groups: { label: string; date: string; events: any[] }[] = [];
  const seen: Record<string, number> = {};
  events.forEach((ev) => {
    const d = new Date(ev.timestamp || ev.created_at || Date.now());
    const key = d.toISOString().split('T')[0];
    let label = key;
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else label = format(d, 'MMM d, yyyy');
    if (seen[key] === undefined) {
      seen[key] = groups.length;
      groups.push({ label, date: key, events: [] });
    }
    groups[seen[key]].events.push(ev);
  });
  return groups;
}

const EvidenceTimelinePage = () => {
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch, isFetching } = useEvidenceTimelineFeed({ limit: 300 });
  const { data: summaryData } = useEvidenceTimelineSummary();

  const rawEvents = useMemo(() => {
    const list = data?.events || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list : [];
  }, [data]);

  const stats = useMemo(() => data?.stats || {
    total: rawEvents.length,
    uploads: rawEvents.filter((e: any) => e.action === 'CREATE:EVIDENCE').length,
    accesses: rawEvents.filter((e: any) => e.action === 'READ:EVIDENCE').length,
    updates: rawEvents.filter((e: any) => e.action === 'UPDATE:EVIDENCE').length,
    deletions: rawEvents.filter((e: any) => e.action === 'DELETE:EVIDENCE').length,
  }, [data, rawEvents]);

  const filtered = useMemo(() => {
    return rawEvents.filter((e: any) => {
      const config = ACTION_CONFIG[e.action] || defaultAction;
      const matchCat = actionFilter === 'all' || config.category === actionFilter;
      const q = search.toLowerCase();
      const matchSearch = !q
        || (e.actor_name || '').toLowerCase().includes(q)
        || (e.action || '').toLowerCase().includes(q)
        || (e.endpoint || '').toLowerCase().includes(q)
        || (e.evidence_name || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [rawEvents, actionFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const toggleGroup = (date: string) =>
    setExpandedGroups(prev => ({ ...prev, [date]: !prev[date] }));

  return (
    <div className="page-container space-y-5 pb-8">
      {/* Header — Operational layer branding */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Evidence Timeline</h1>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Activity className="h-2.5 w-2.5" /> Operational Layer
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Full lifecycle of evidence items — uploads, edits, analysis, and processing history
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-[12px]"
          onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {/* Layer Distinction Info */}
      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Operational history</span> — shows what happened to evidence items during the investigation:
          uploads, modifications, analysis runs, and downloads. Unlike{' '}
          <span className="text-amber-600 dark:text-amber-400 font-medium">Chain of Custody</span> (legal/immutable), some entries here reflect routine investigative work.
          Unlike <span className="text-slate-500 font-medium">Audit Logs</span> (all system events), this is filtered to evidence-specific actions only.
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total || rawEvents.length, icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Uploads', value: stats.uploads || 0, icon: Upload, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Accesses', value: stats.accesses || 0, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Edits', value: stats.updates || 0, icon: Edit3, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Deletions', value: stats.deletions || 0, icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: macEase }}>
            <Card className="stat-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0', s.bg)}>
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[16px] font-extrabold leading-none">{isLoading ? '—' : s.value}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Category chips */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button key={cat.id} onClick={() => setActionFilter(cat.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
                  actionFilter === cat.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}>
                <Icon className="h-3 w-3" strokeWidth={1.8} />
                {cat.label}
              </button>
            );
          })}
        </div>
        {/* Search */}
        <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input placeholder="Filter by actor, action…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-[12px] bg-background border-border/50 rounded-lg" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Loading evidence timeline…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-[13px] text-muted-foreground font-medium">
            {rawEvents.length === 0 ? 'No evidence lifecycle events recorded yet' : 'No matching events'}
          </p>
          {rawEvents.length > 0 && (
            <button onClick={() => { setActionFilter('all'); setSearch(''); }}
              className="mt-2 text-[11px] text-primary font-medium hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group, gi) => {
            const isExpanded = expandedGroups[group.date] !== false; // default open
            return (
              <motion.div key={group.date}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.06, duration: 0.25, ease: macEase }}>
                {/* Date separator */}
                <button onClick={() => toggleGroup(group.date)}
                  className="flex items-center gap-2 w-full mb-2 group">
                  <div className="h-px flex-1 bg-border/30" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 text-[10px] font-bold text-muted-foreground hover:bg-muted/70 transition-colors">
                    <Calendar className="h-3 w-3" />
                    {group.label}
                    <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">{group.events.length}</Badge>
                    <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', !isExpanded && '-rotate-90')} />
                  </div>
                  <div className="h-px flex-1 bg-border/30" />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden">
                      <div className="relative ml-2">
                        {/* Timeline line */}
                        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gradient-to-b from-blue-500/30 via-border/20 to-transparent" />

                        <div className="space-y-2">
                          {group.events.map((event: any, ei: number) => {
                            const config = ACTION_CONFIG[event.action] || defaultAction;
                            const Icon = config.icon;
                            const ok = (event.status_code || 200) < 400;
                            const time = event.timestamp
                              ? format(new Date(event.timestamp), 'HH:mm:ss')
                              : '—';
                            const ago = event.timestamp
                              ? formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })
                              : '';

                            return (
                              <div key={event.log_id || ei}
                                className="relative flex gap-3 group">
                                {/* Dot */}
                                <div className="relative z-10 mt-3 shrink-0">
                                  <div className={cn(
                                    'h-[10px] w-[10px] rounded-full border-[2px] border-background',
                                    ok ? config.bg.replace('/10', '/80') : 'bg-red-500/80'
                                  )}
                                    style={{ boxShadow: '0 0 0 1.5px hsl(var(--background))' }}
                                  />
                                </div>

                                {/* Event card */}
                                <div className="flex-1 mb-1">
                                  <div className={cn(
                                    'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors hover:bg-muted/10',
                                    config.border.replace('/20', '/10'), 'bg-background/50'
                                  )}>
                                    <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5', config.bg, 'border', config.border)}>
                                      <Icon className={cn('h-3.5 w-3.5', config.color)} strokeWidth={1.8} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[12px] font-bold">{config.label}</span>
                                        {event.evidence_name && (
                                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                                            {event.evidence_name}
                                          </span>
                                        )}
                                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                          <span className={cn(
                                            'text-[9px] font-bold px-1 py-0.5 rounded border',
                                            ok ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                                          )}>
                                            {event.status_code || 200}
                                          </span>
                                          <span className="text-[10px] font-mono text-muted-foreground/60">{time}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {event.actor_name || event.user_id?.slice(0, 10) || 'System'}
                                        </span>
                                        {event.response_time_ms && (
                                          <span className="text-muted-foreground/50">{event.response_time_ms}ms</span>
                                        )}
                                        <span className="text-muted-foreground/40">{ago}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          <p className="text-[11px] text-muted-foreground/40 text-center pt-2">
            Showing {filtered.length} of {rawEvents.length} events
          </p>
        </div>
      )}
    </div>
  );
};

export default EvidenceTimelinePage;
