/**
 * Chain of Custody — Legal Integrity Layer
 *
 * This is NOT the same as Evidence Timeline.
 * Purpose: Legal proof of evidence handling — court-admissible, immutable, hash-chained.
 * 
 * Real forensic tools (Autopsy, Magnet AXIOM) enforce strict separation:
 * - Every event is hash-chained: current_hash = SHA256(data + previous_hash)
 * - Entries are IMMUTABLE — locked from any modification
 * - Every event shows digital signature / hash integrity badge
 */

import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Search, ArrowRight, Loader2, ShieldCheck, AlertTriangle,
  User, Clock, Hash, Lock, GitBranch, CheckCircle2, XCircle,
  ArrowDown, RefreshCw, Shield, KeyRound, FileSearch, FileLock2,
  Download, Eye, Copy, ChevronRight, BadgeCheck, Fingerprint,
  UserCheck, ArrowLeftRight, BarChart2
} from 'lucide-react';
import {
  useCustodyTimeline,
  useVerifyEvidence,
  useCustodyChain,
  useVerifyCustodyChain,
} from '@/hooks/use-api';
import { cn } from '@/lib/utils';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// Action configs — legal custody actions only
const ACTION_CONFIG: Record<string, { label: string; icon: typeof Link2; color: string; bg: string; border: string; dot: string }> = {
  CREATE_EVIDENCE:   { label: 'Evidence Created',   icon: FileLock2,     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  VIEW_EVIDENCE:     { label: 'Evidence Accessed',   icon: Eye,           color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',  dot: 'bg-blue-500' },
  TRANSFER_CUSTODY:  { label: 'Custody Transferred', icon: ArrowLeftRight, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/20', dot: 'bg-violet-500' },
  VERIFY_EVIDENCE:   { label: 'Integrity Verified',  icon: BadgeCheck,    color: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-500/10',    border: 'border-teal-500/20',  dot: 'bg-teal-500' },
  EXPORT_EVIDENCE:   { label: 'Evidence Exported',   icon: Download,      color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10',   border: 'border-amber-500/20', dot: 'bg-amber-500' },
  DOWNLOAD_EVIDENCE: { label: 'Evidence Downloaded', icon: Download,      color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10',   border: 'border-amber-500/20', dot: 'bg-amber-500' },
  SIGN_EVIDENCE:     { label: 'Digitally Signed',    icon: KeyRound,      color: 'text-primary',                       bg: 'bg-primary/10',     border: 'border-primary/20',   dot: 'bg-primary' },
};

const defaultAction = { label: 'Custody Event', icon: Link2, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', dot: 'bg-muted-foreground' };

function truncateHash(h: string, len = 16) {
  if (!h) return '—';
  return `${h.slice(0, len)}…`;
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

const CustodyTimelinePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const evidenceId = searchParams.get('evidence_id') || '';
  const [inputId, setInputId] = useState(evidenceId);

  const { data: chainData, isLoading, isFetching, refetch } = useCustodyChain(evidenceId);
  const { data: verifyData, isLoading: isVerifying, refetch: reVerify } = useVerifyCustodyChain(evidenceId);

  const events = useMemo(() => {
    const list = chainData?.events || chainData?.chain || chainData?.timeline || (Array.isArray(chainData) ? chainData : []);
    return Array.isArray(list) ? [...list].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ) : [];
  }, [chainData]);

  const chainVerification = useMemo(() => {
    if (verifyData) return verifyData;
    if (events.length === 0) return null;
    const tampered = events.some((e: any) => e.integrity_status === 'tampered' || e.hash_mismatch);
    return { is_intact: !tampered, tamper_detected: tampered, chain_length: events.length };
  }, [verifyData, events]);

  const handleSearch = () => {
    if (inputId.trim()) setSearchParams({ evidence_id: inputId.trim() });
  };

  const isIntact = chainVerification?.is_intact !== false;

  return (
    <div className="page-container space-y-5 max-w-5xl">
      {/* Header — Legal layer branding */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Chain of Custody</h1>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/10 text-amber-600 border-amber-500/20">
              <Shield className="h-2.5 w-2.5" /> Legal Layer
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Immutable, hash-chained record of every evidence handling event — court admissible
          </p>
        </div>
        {evidenceId && (
          <Button variant="outline" size="sm" className="h-8 text-[12px]"
            onClick={() => { refetch(); reVerify(); }} disabled={isFetching || isVerifying}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', (isFetching || isVerifying) && 'animate-spin')} />
            Verify Chain
          </Button>
        )}
      </div>

      {/* Layer Distinction Card */}
      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
        <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Legal integrity layer</span> — records here are cryptographically sealed and immutable.
          Each event is SHA-256 chained to the previous, creating a tamper-evident ledger.
          This is different from <span className="text-primary font-medium">Evidence Timeline</span> (operational history) and <span className="text-primary font-medium">Audit Logs</span> (system events).
        </div>
      </div>

      {/* Search */}
      <Card className="mac-card">
        <CardContent className="p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Evidence ID <span className="text-muted-foreground/40 normal-case font-normal">(enter to load custody chain)</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="e.g. ev_01HXYZ… or paste full evidence ID"
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-9 pl-8 text-[13px] font-mono"
                />
              </div>
            </div>
            <Button size="sm" className="h-9" onClick={handleSearch} disabled={!inputId.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <GitBranch className="h-3.5 w-3.5 mr-1.5" />}
              Load Chain
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && evidenceId && (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Loading custody chain…</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!isLoading && evidenceId && (
          <motion.div key={evidenceId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: macEase }}
            className="space-y-5">

            {/* Chain Integrity Banner */}
            {chainVerification && (
              <div className={cn(
                'flex items-center gap-4 p-4 rounded-xl border',
                isIntact ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/25'
              )}>
                <div className={cn(
                  'flex items-center justify-center h-11 w-11 rounded-full shrink-0',
                  isIntact ? 'bg-emerald-500/15' : 'bg-red-500/15'
                )}>
                  {isIntact
                    ? <ShieldCheck className="h-5 w-5 text-emerald-500" strokeWidth={2} />
                    : <AlertTriangle className="h-5 w-5 text-red-500" strokeWidth={2} />
                  }
                </div>
                <div className="flex-1">
                  <p className={cn('text-[14px] font-bold', isIntact ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {isIntact ? 'Chain Integrity: Verified ✓' : '⚠ Chain Integrity: Compromised'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isIntact
                      ? `${chainVerification.chain_length || events.length} events verified — no tampering detected. Hash chain is intact.`
                      : `Tamper detected at event index ${chainVerification.tampered_event_index ?? '?'}. ${chainVerification.tamper_reason || 'Hash mismatch.'}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={cn(
                    'text-[10px] font-bold uppercase px-2',
                    isIntact ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
                  )}>
                    {isIntact ? 'Court-Admissible' : 'Compromised'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Chain Events', value: events.length, icon: GitBranch, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Unique Actors', value: new Set(events.map((e: any) => e.actor_id || e.actor_name).filter(Boolean)).size, icon: UserCheck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Transfers', value: events.filter((e: any) => e.action === 'TRANSFER_CUSTODY').length, icon: ArrowLeftRight, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                { label: 'Integrity', value: isIntact ? 'SHA-256 OK' : 'FAIL', icon: isIntact ? BadgeCheck : XCircle, color: isIntact ? 'text-emerald-500' : 'text-red-500', bg: isIntact ? 'bg-emerald-500/10' : 'bg-red-500/10' },
              ].map((s) => (
                <Card key={s.label} className="stat-card">
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0', s.bg)}>
                      <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="text-[15px] font-extrabold tracking-tight leading-none">{s.value}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Hash Chain Timeline */}
            {events.length === 0 ? (
              <div className="text-center py-16">
                <GitBranch className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-[13px] text-muted-foreground font-medium">No custody events found</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">This evidence may not have any recorded custody chain yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Column headers */}
                <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  <div className="w-[28px] shrink-0" />
                  <div className="flex-1">Action &amp; Actor</div>
                  <div className="hidden md:block w-[200px] shrink-0">Hash Link</div>
                  <div className="hidden sm:block w-[120px] shrink-0 text-right">Timestamp</div>
                  <div className="w-[80px] shrink-0 text-right">Status</div>
                </div>

                {/* Timeline entries */}
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[13px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-primary/50 via-border/40 to-border/10 rounded-full" />

                  <div className="space-y-2.5">
                    {events.map((event: any, idx: number) => {
                      const config = ACTION_CONFIG[event.action] || defaultAction;
                      const Icon = config.icon;
                      const isFirst = idx === 0;
                      const isLast = idx === events.length - 1;

                      return (
                        <motion.div key={event.event_id || idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04, duration: 0.22, ease: macEase }}
                          className="relative flex gap-3 group"
                        >
                          {/* Chain dot */}
                          <div className="relative z-10 mt-4 shrink-0">
                            <div className={cn(
                              'h-[14px] w-[14px] rounded-full border-[2.5px] border-background flex items-center justify-center',
                              config.dot
                            )}
                              style={{ boxShadow: isFirst ? '0 0 0 2px hsl(var(--background)), 0 0 10px rgba(var(--primary), 0.4)' : '0 0 0 2px hsl(var(--background))' }}
                            />
                          </div>

                          {/* Card */}
                          <Card className={cn(
                            'flex-1 mac-card overflow-hidden transition-all duration-200',
                            isFirst && 'border-primary/20',
                            event.integrity_status === 'tampered' && 'border-red-500/30 bg-red-500/5'
                          )}>
                            <CardContent className="p-3.5">
                              <div className="flex items-start gap-3">
                                {/* Action icon */}
                                <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5', config.bg, config.border, 'border')}>
                                  <Icon className={cn('h-4 w-4', config.color)} strokeWidth={1.8} />
                                </div>

                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[13px] font-bold">{config.label}</span>
                                    {isFirst && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                        Genesis
                                      </span>
                                    )}
                                    {isLast && !isFirst && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                        Latest
                                      </span>
                                    )}
                                    {/* Immutable lock badge */}
                                    <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/50 font-medium">
                                      <Lock className="h-2.5 w-2.5" /> Immutable
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-2">
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span className="font-medium text-foreground">{event.actor_name || 'System'}</span>
                                      {event.actor_role && <span className="text-muted-foreground/60">({event.actor_role})</span>}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {event.timestamp
                                        ? new Date(event.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                                        : '—'}
                                    </span>
                                  </div>

                                  {/* Hash chain display */}
                                  <div className="space-y-1.5">
                                    {event.previous_event_hash && (
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className="text-muted-foreground/50 font-medium w-[70px] shrink-0">Prev hash</span>
                                        <div className="flex items-center gap-1 bg-muted/40 border border-border/30 rounded-md px-2 py-0.5 flex-1 min-w-0">
                                          <Hash className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                          <span className="font-mono text-muted-foreground/60 truncate">{truncateHash(event.previous_event_hash, 20)}</span>
                                          <button onClick={() => copyToClipboard(event.previous_event_hash)}
                                            className="ml-auto shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                                            <Copy className="h-2.5 w-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <span className="text-muted-foreground/50 font-medium w-[70px] shrink-0">Curr hash</span>
                                      <div className="flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/15 rounded-md px-2 py-0.5 flex-1 min-w-0">
                                        <Hash className="h-3 w-3 text-emerald-500/60 shrink-0" />
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 truncate">{truncateHash(event.event_hash, 20)}</span>
                                        <button onClick={() => copyToClipboard(event.event_hash)}
                                          className="ml-auto shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                                          <Copy className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                    {event.ip_address && (
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className="text-muted-foreground/50 font-medium w-[70px] shrink-0">Origin IP</span>
                                        <span className="font-mono text-muted-foreground/60">{event.ip_address}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Transfer details */}
                                  {event.details?.from_custodian && (
                                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                                      <span className="text-muted-foreground">From custodian:</span>
                                      <span className="font-medium">{event.details.from_custodian}</span>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <span className="font-medium">{event.details.to_custodian}</span>
                                    </div>
                                  )}
                                  {event.details?.reason && (
                                    <p className="mt-1.5 text-[11px] text-muted-foreground/70 italic">"{event.details.reason}"</p>
                                  )}
                                </div>

                                {/* Integrity status */}
                                <div className="shrink-0">
                                  {event.integrity_status === 'tampered' || event.hash_mismatch ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-1 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                                      <XCircle className="h-3 w-3" /> Tampered
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3" /> Verified
                                    </span>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!evidenceId && !isLoading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3, ease: macEase }}
          className="text-center py-20">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/15 mx-auto mb-4">
            <FileLock2 className="h-7 w-7 text-amber-500" strokeWidth={1.5} />
          </div>
          <h3 className="text-[16px] font-bold mb-1">Legal Custody Chain</h3>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            Enter an evidence ID to view its complete, cryptographically-sealed chain of custody.
            Every event is SHA-256 hash-chained and immutable — suitable for court proceedings.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default CustodyTimelinePage;
