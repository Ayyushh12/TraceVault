/**
 * Evidence Detail Page — Split View Layout
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────┐
 * │  Header: breadcrumb + name + actions                 │
 * ├────────────────────────┬─────────────────────────────┤
 * │  LEFT PANEL (40%)      │  RIGHT PANEL TABS           │
 * │  · Metadata            │  [Custody|Timeline|Activity|Logs]
 * │  · SHA-256 hash        │                             │
 * │  · File info           │  Tab content (scrollable)   │
 * │  · Lock status         │                             │
 * │  · Version history     │                             │
 * └────────────────────────┴─────────────────────────────┘
 *
 * Tab differentiation:
 * - Custody   → strict, locked, hash chain (amber/legal)
 * - Timeline  → rich operational history (blue/operational)
 * - Activity  → behavior charts (green/behavioral)
 * - Logs      → raw system table (slate/system)
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, File, User, Calendar, HardDrive, Hash,
  Download, ArrowLeft, Loader2, Copy, CheckCircle2,
  Clock, AlertTriangle, Fingerprint, Activity, Terminal, Eye,
  FileCode2, Lock, Unlock, Search, ChevronDown, ChevronUp,
  RefreshCw, Upload, GitBranch, Link2, FileText, Monitor,
  ArrowLeftRight, KeyRound, FileLock2, BadgeCheck, XCircle,
  ZoomIn, Shield, Info, ArrowRight, BarChart2, Globe, Send
} from 'lucide-react';
import {
  useEvidenceDetail,
  useVerifyEvidence,
  useDownloadEvidence,
  useCustodyTimeline,
  useAnalyzeEvidence,
  useLockEvidence,
  useUnlockEvidence,
  useEvidenceVersions,
  useAuditLogs,
  useEvidenceTimelineFeed,
  useCustodyChain,
  useTransferCustody
} from '@/hooks/use-api';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Tab definitions ─────────────────────────────────────────────
const TABS = [
  {
    id: 'custody',
    label: 'Chain of Custody',
    icon: Link2,
    badge: 'Legal',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    description: 'Immutable hash-chained events',
  },
  {
    id: 'timeline',
    label: 'Evidence Timeline',
    icon: Clock,
    badge: 'Operational',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    description: 'Full lifecycle history',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    badge: 'Behavior',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    description: 'User access patterns',
  },
  {
    id: 'logs',
    label: 'System Logs',
    icon: FileText,
    badge: 'System',
    badgeColor: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    description: 'Raw API & system events',
  },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── Custody action config ───────────────────────────────────────
const CUSTODY_ACTIONS: Record<string, { label: string; icon: typeof Link2; color: string; bg: string }> = {
  CREATE_EVIDENCE:   { label: 'Evidence Created',   icon: FileLock2,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  VIEW_EVIDENCE:     { label: 'Evidence Accessed',  icon: Eye,           color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  TRANSFER_CUSTODY:  { label: 'Custody Transferred',icon: ArrowLeftRight, color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  VERIFY_EVIDENCE:   { label: 'Integrity Verified', icon: BadgeCheck,    color: 'text-teal-500',    bg: 'bg-teal-500/10' },
  EXPORT_EVIDENCE:   { label: 'Evidence Exported',  icon: Download,      color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  DOWNLOAD_EVIDENCE: { label: 'Evidence Downloaded',icon: Download,      color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  SIGN_EVIDENCE:     { label: 'Digitally Signed',   icon: KeyRound,      color: 'text-primary',     bg: 'bg-primary/10' },
};
const defaultCustody = { label: 'Custody Event', icon: Link2, color: 'text-muted-foreground', bg: 'bg-muted/50' };

const TIMELINE_ACTIONS: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  'CREATE:EVIDENCE': { label: 'Uploaded',     icon: Upload,      color: 'text-emerald-500' },
  'READ:EVIDENCE':   { label: 'Accessed',     icon: Eye,         color: 'text-blue-500' },
  'UPDATE:EVIDENCE': { label: 'Modified',     icon: FileCode2,   color: 'text-amber-500' },
  'DELETE:EVIDENCE': { label: 'Deleted',      icon: XCircle,     color: 'text-red-500' },
  evidence_verify:   { label: 'Verified',     icon: ShieldCheck, color: 'text-teal-500' },
  evidence_download: { label: 'Downloaded',   icon: Download,    color: 'text-indigo-500' },
};
const defaultTimeline = { label: 'Event', icon: Activity, color: 'text-muted-foreground' };

// ── Helpers ──────────────────────────────────────────────────────
function truncHash(h: string, n = 14) { return h ? `${h.slice(0, n)}…` : '—'; }
function fmtTime(ts: string) { return ts ? format(new Date(ts), 'MMM d, HH:mm') : '—'; }
function fmtSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// ── Sub-components ───────────────────────────────────────────────
const MetaRow = ({ label, value, icon: Icon, mono }: { label: string; value: string; icon: any; mono?: boolean }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
    <div className="flex items-center gap-1.5 text-muted-foreground w-[100px] shrink-0 mt-0.5">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className={cn('text-[12px] font-medium leading-tight break-all', mono && 'font-mono text-[11px] text-emerald-600 dark:text-emerald-400')}>
      {value}
    </span>
  </div>
);

const HashRow = ({ label, value, icon: Icon, onCopy, copied }: any) => (
  <div className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors">
    <div className="flex items-center gap-1.5 text-muted-foreground w-[90px] shrink-0">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
      <span className="text-[9px] font-bold text-muted-foreground">{label}</span>
    </div>
    <span className="text-[10px] font-mono text-muted-foreground/70 truncate flex-1">{value}</span>
    {onCopy && (
      <button onClick={onCopy}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-all">
        {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    )}
  </div>
);

// ── Main Page ────────────────────────────────────────────────────
const EvidenceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useEvidenceDetail(id || '');
  const { data: custodyData, isLoading: custodyLoading } = useCustodyChain(id || '');
  const { data: timelineData, isLoading: timelineLoading } = useEvidenceTimelineFeed({ evidence_id: id, limit: 100 });
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 50 });
  const { data: versionsData } = useEvidenceVersions(id || '');
  const { data: forensicData, refetch: runAnalysis, isFetching: isAnalyzing, isSuccess: analysisSuccess } = useAnalyzeEvidence(id || '');

  const verifyMutation = useVerifyEvidence();
  const downloadMutation = useDownloadEvidence();
  const lockMutation = useLockEvidence();
  const unlockMutation = useUnlockEvidence();
  const transferMutation = useTransferCustody();

  const [activeTab, setActiveTab] = useState<TabId>('custody');
  const [copied, setCopied] = useState<string | null>(null);
  const [showForensics, setShowForensics] = useState(false);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState('');

  // Transfer Custody State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const evidence = data?.evidence || data;

  const custodyChain = useMemo(() => {
    const list = custodyData?.events || custodyData?.chain || custodyData?.timeline || (Array.isArray(custodyData) ? custodyData : []);
    return Array.isArray(list) ? [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
  }, [custodyData]);

  const timelineEvents = useMemo(() => {
    const list = timelineData?.events || (Array.isArray(timelineData) ? timelineData : []);
    return Array.isArray(list) ? list.filter((e: any) =>
      !id || e.endpoint?.includes(id) || JSON.stringify(e.request_body || '').includes(id)
    ) : [];
  }, [timelineData, id]);

  const allLogs = useMemo(() => {
    const list = auditData?.logs || auditData?.data?.logs || (Array.isArray(auditData) ? auditData : []);
    return Array.isArray(list) ? list.filter((e: any) =>
      e.endpoint?.includes(id) || JSON.stringify(e.request_body || '').includes(id || '')
    ) : [];
  }, [auditData, id]);

  const filteredLogs = useMemo(() => {
    if (!logSearch) return allLogs;
    const q = logSearch.toLowerCase();
    return allLogs.filter((l: any) =>
      (l.action || '').toLowerCase().includes(q) ||
      (l.actor_name || '').toLowerCase().includes(q) ||
      (l.endpoint || '').toLowerCase().includes(q)
    );
  }, [allLogs, logSearch]);

  // Activity stats per user for this evidence
  const activityStats = useMemo(() => {
    const dist: Record<string, { count: number; errors: number; name: string }> = {};
    [...timelineEvents, ...allLogs].forEach((l: any) => {
      const uid = l.user_id || l.actor_id || 'system';
      if (!dist[uid]) dist[uid] = { count: 0, errors: 0, name: l.actor_name || 'System' };
      dist[uid].count++;
      if ((l.status_code || 200) >= 400) dist[uid].errors++;
    });
    return Object.entries(dist).sort((a, b) => b[1].count - a[1].count);
  }, [timelineEvents, allLogs]);

  const copyHash = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
    toast({ title: 'Copied', description: `${label} copied to clipboard.` });
  };

  if (isLoading) return <LoadingSpinner text="Loading evidence record…" />;

  if (error || !evidence) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <File className="h-8 w-8 text-muted-foreground opacity-40" />
        <p className="text-sm font-medium">Record Not Found</p>
        <p className="text-[12px] text-muted-foreground max-w-xs text-center">
          Evidence ID does not exist or you lack permission.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/evidence')}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Evidence
        </Button>
      </div>
    );
  }

  const isVerified = evidence.integrity_status === 'verified';
  const isTampered = evidence.integrity_status === 'tampered';

  return (
    <div className="h-full flex flex-col gap-0 max-w-[1400px] mx-auto">

      {/* ── Compact header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => navigate('/evidence')}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Badge variant="outline" className="text-[9px] uppercase font-mono shrink-0">
              {(evidence.evidence_id || id || '').slice(0, 12)}…
            </Badge>
            <Badge variant="outline" className={cn(
              'text-[9px] uppercase font-bold shrink-0',
              isVerified ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                : isTampered ? 'bg-red-500/10 text-red-600 border-red-500/25'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/25'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5',
                isVerified ? 'bg-emerald-500' : isTampered ? 'bg-red-500' : 'bg-amber-500'
              )} />
              {isVerified ? 'Verified' : isTampered ? 'Tampered' : 'Pending'}
            </Badge>
            <h1 className="text-[14px] font-bold truncate">
              {evidence.original_name || evidence.file_name || 'Evidence Record'}
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="default" className="h-8 px-3 text-[11px]"
            onClick={() => verifyMutation.mutate(evidence.evidence_id || id || '')}
            disabled={verifyMutation.isPending}>
            {verifyMutation.isPending
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Fingerprint className="mr-1.5 h-3.5 w-3.5" />}
            Verify
          </Button>
          <Button variant="outline" className="h-8 px-3 text-[11px]"
            onClick={() => { setShowForensics(true); if (!forensicData) runAnalysis(); }}
            disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Terminal className="mr-1.5 h-3.5 w-3.5" />}
            Inspect
          </Button>
          <Button 
            variant={evidence.is_locked ? "destructive" : "outline"} 
            className={cn('h-8 px-3 text-[11px]', evidence.is_locked && 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/30')}
            onClick={() => {
              if (evidence.is_locked) {
                if (window.confirm('Release legal lock? This will be recorded in the audit trail.')) {
                  unlockMutation.mutate({ id: evidence.evidence_id || id || '', reason: 'Authorized release' });
                }
              } else {
                if (window.confirm('Lock this evidence for 24 hours? All downloads and transfers will be strictly blocked.')) {
                  lockMutation.mutate({ id: evidence.evidence_id || id || '', durationHours: 24, reason: 'Administrative Review Lock' });
                }
              }
            }}
            disabled={lockMutation.isPending || unlockMutation.isPending}>
            {lockMutation.isPending || unlockMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : 
             evidence.is_locked ? <Lock className="h-3.5 w-3.5 mr-1.5" /> : <Unlock className="h-3.5 w-3.5 mr-1.5" />}
            {evidence.is_locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button variant="outline" className="h-8 px-3 text-[11px]"
            onClick={() => setIsTransferOpen(true)}
            disabled={evidence.is_locked || transferMutation.isPending}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Transfer
          </Button>
          <Button variant="outline" className="h-8 w-8 px-0 flex justify-center items-center"
            title={evidence.is_locked ? "Download Blocked — Evidence Locked" : "Download Evidence"}
            onClick={() => downloadMutation.mutate({ evidence_id: evidence.evidence_id, original_name: evidence.original_name })}
            disabled={downloadMutation.isPending || evidence.is_locked}>
            {downloadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Verification banner ────────────────────────────────── */}
      <AnimatePresence>
        {verifyMutation.data && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border/20">
            <div className={cn('flex items-center gap-3 px-4 py-2',
              verifyMutation.data?.overall_result === 'pass'
                ? 'bg-emerald-500/5' : 'bg-red-500/5')}>
              {verifyMutation.data?.overall_result === 'pass'
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-[12px] font-semibold text-emerald-600">Integrity Confirmed — computed hash matches stored signature</span></>
                : <><AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-[12px] font-semibold text-red-600">Integrity Compromised — hash mismatch detected</span></>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transfer Custody Dialog ────────────────────────────── */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-violet-500" />
              Transfer Chain of Custody
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Transferring custody permanently logs a cryptographically signed event locking the asset to the new owner. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold">Recipient User ID</Label>
              <Input
                placeholder="Enter exact system UID of the receiving agent..."
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="h-9 text-[12px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold">Reason for Transfer (Required)</Label>
              <Textarea
                placeholder="e.g. Authorized transfer to forensics lab for deep malware analysis..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                className="h-20 max-h-32 text-[12px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsTransferOpen(false)}>Cancel</Button>
            <Button size="sm" 
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={!transferTarget.trim() || !transferReason.trim() || transferMutation.isPending}
              onClick={() => {
                transferMutation.mutate({
                  id: evidence.evidence_id || id || '',
                  to_user_id: transferTarget.trim(),
                  reason: transferReason.trim()
                });
                setIsTransferOpen(false);
                setTransferTarget('');
                setTransferReason('');
              }}>
              {transferMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Split view ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT PANEL — Metadata ─────────────────────────────── */}
        <div className="w-full lg:w-[360px] shrink-0 border-r border-border/30 overflow-y-auto p-4 space-y-4">

          {/* Core Security Metric Card */}
          <Card className="bg-gradient-to-br from-background to-muted/30 border-border/50 shadow-sm relative overflow-hidden">
            <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 pointer-events-none rounded-full",
              isVerified ? "bg-emerald-500" : isTampered ? "bg-red-500" : "bg-amber-500"
            )} />
            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <span className="text-[12px] font-bold tracking-tight">Cryptographic Root</span>
              </div>
              <Badge variant="outline" className={cn('text-[9px] uppercase font-bold',
                isVerified ? 'text-emerald-600 border-emerald-500/30' : isTampered ? 'text-red-500 border-red-500/30' : 'text-amber-500'
              )}>
                {isVerified ? 'VERIFIED' : isTampered ? 'TAMPERED' : 'UNVERIFIED'}
              </Badge>
            </div>
            <div className="p-4 pt-3 flex flex-col gap-3">
              <div className="group flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SHA-256 Digest</span>
                <div className="flex items-center justify-between bg-muted/40 rounded-md p-2 border border-border/40">
                  <span className="text-[12px] font-mono font-medium truncate text-foreground pr-2">{evidence.file_hash || '—'}</span>
                  <button onClick={() => copyHash(evidence.file_hash, 'SHA-256')}
                    className="shrink-0 p-1.5 rounded-sm hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                    {copied === 'SHA-256' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Evidence ID</span>
                  <span className="text-[11px] font-mono text-foreground/80 truncate">{evidence.evidence_id || id || '—'}</span>
                </div>
                {evidence.case_id && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Case ID</span>
                    <span className="text-[11px] font-mono text-blue-500 truncate cursor-not-allowed">{evidence.case_id}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Details Card */}
          <Card className="border-border/50 shadow-sm">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <File className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              <span className="text-[12px] font-bold tracking-tight">Technical Properties</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between border-b border-border/10">
               <div className="flex items-center gap-2 text-muted-foreground">
                 <HardDrive className="h-3.5 w-3.5" />
                 <span className="text-[11px] font-bold uppercase tracking-wider">MIME Type</span>
               </div>
               <span className="text-[12px] font-medium font-mono text-foreground/80">{evidence.mime_type || 'application/octet-stream'}</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between border-b border-border/10">
               <div className="flex items-center gap-2 text-muted-foreground">
                 <Calendar className="h-3.5 w-3.5" />
                 <span className="text-[11px] font-bold uppercase tracking-wider">Date Bound</span>
               </div>
               <span className="text-[12px] font-medium text-foreground/80">{evidence.created_at ? format(new Date(evidence.created_at), 'MMM d, yyyy HH:mm') : '—'}</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between border-b border-border/10">
               <div className="flex items-center gap-2 text-muted-foreground">
                 <User className="h-3.5 w-3.5" />
                 <span className="text-[11px] font-bold uppercase tracking-wider">Originator</span>
               </div>
               <span className="text-[12px] font-medium text-foreground/80">{evidence.uploaded_by_name || evidence.uploaded_by || '—'}</span>
            </div>
            <div className="px-4 py-2 flex flex-col gap-1">
               <div className="flex items-center gap-2 text-muted-foreground mb-1">
                 <Shield className="h-3.5 w-3.5" />
                 <span className="text-[11px] font-bold uppercase tracking-wider">Asset Lock Status</span>
               </div>
               <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className={cn("text-[10px] py-0 border", evidence.is_locked ? "bg-red-500/10 border-red-500/20 text-red-500 font-bold" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 font-bold")}>
                    {evidence.is_locked ? "LOCKED" : "UNLOCKED"}
                  </Badge>
                  {evidence.is_locked && (
                    <span className="text-[11px] text-muted-foreground">Expires {new Date(evidence.lock_expiry).toLocaleString()}</span>
                  )}
               </div>
            </div>
          </Card>

          {/* Version history */}
          <Card className="mac-card">
            <div className="px-3 py-2.5 border-b border-border/25 flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Version History</span>
              {versionsData?.versions?.length > 0 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">{versionsData.versions.length}</Badge>
              )}
            </div>
            <div className="p-2">
              {!versionsData?.versions?.length ? (
                <div className="text-center py-4">
                  <GitBranch className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground">No versions recorded</p>
                </div>
              ) : versionsData.versions.map((v: any) => (
                <div key={v._id} className="px-2 py-2 rounded-lg hover:bg-muted/20 border-b border-border/20 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20 px-1.5 py-0.5 rounded">
                      <GitBranch className="h-2.5 w-2.5" /> v{v.version_number}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{v.created_at ? format(new Date(v.created_at), 'MMM d HH:mm') : '—'}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">By <strong>{v.changed_by_name || 'Unknown'}</strong> — {v.change_reason}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Elite Forensic Console Overlay */}
          <AnimatePresence>
            {showForensics && (
              <Dialog open={showForensics} onOpenChange={setShowForensics}>
                <DialogContent className="max-w-[1200px] w-[95vw] h-[85vh] p-0 overflow-hidden bg-black/95 backdrop-blur-xl border border-indigo-500/30 flex flex-col shadow-2xl shadow-indigo-500/20">
                  
                  {/* Console Header */}
                  <div className="px-5 py-3 border-b border-indigo-500/30 flex items-center justify-between bg-indigo-500/5">
                    <div className="flex items-center gap-3">
                      <Terminal className="h-4 w-4 text-indigo-400" />
                      <span className="text-[13px] font-bold text-indigo-300 tracking-wider">FORENSIC ANALYSIS ENGINE</span>
                      {isAnalyzing ? (
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 text-[9px] animate-pulse">Running Deep Scan</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">Scan Complete</Badge>
                      )}
                    </div>
                  </div>

                  {/* Console Body */}
                  <div className="flex-1 flex overflow-hidden">
                    {isAnalyzing ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-indigo-400 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-[12px] font-mono tracking-widest animate-pulse">EXTRACTING METADATA & GENERATING HEX DUMP...</span>
                      </div>
                    ) : analysisSuccess && forensicData?.analysis ? (
                      <>
                        {/* Left Column: Diagnostics */}
                        <div className="w-[320px] shrink-0 border-r border-indigo-500/20 p-5 space-y-6 overflow-y-auto bg-black/40">
                          
                          <div>
                            <span className="block text-[10px] font-bold text-indigo-400/70 mb-2 tracking-widest">FILE IDENTITY</span>
                            <div className="space-y-3">
                              <div>
                                <span className="block text-[9px] text-muted-foreground mb-0.5">Magic Bytes Detected</span>
                                <span className="text-[12px] text-white font-mono">{forensicData.analysis.magic_bytes_detected}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-muted-foreground mb-0.5">Shannon Entropy Score</span>
                                <div className="flex items-center gap-3">
                                  <span className={cn("text-[20px] font-bold font-mono leading-none", forensicData.analysis.entropy > 7.5 ? "text-red-400" : "text-emerald-400")}>
                                    {forensicData.analysis.entropy.toFixed(3)}
                                  </span>
                                </div>
                                {/* Entropy Visual Bar */}
                                <div className="mt-2 h-1.5 w-full bg-border/40 rounded-full overflow-hidden flex">
                                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (forensicData.analysis.entropy/8)*100)}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground mt-1 block">{(forensicData.analysis.entropy > 7.5) ? 'High entropy indicates encryption or extreme compression.' : 'Normal entropy range.' }</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-muted-foreground mb-0.5">Extraction Time</span>
                                <span className="text-[11px] text-white font-mono">{new Date(forensicData.analyzed_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-indigo-500/20">
                            <span className="block text-[10px] font-bold text-indigo-400/70 mb-2 tracking-widest">PRINTABLE STRINGS ({forensicData.analysis.extracted_strings?.length || 0})</span>
                            <div className="bg-background/20 rounded border border-indigo-500/20 p-2 h-[220px] overflow-y-auto space-y-1">
                              {!forensicData.analysis.extracted_strings?.length ? (
                                <p className="text-[10px] text-muted-foreground text-center py-4">No ASCII strings found.</p>
                              ) : (
                                forensicData.analysis.extracted_strings.map((str: any, idx: number) => (
                                  <div key={idx} className="flex gap-2">
                                    <span className="text-[9px] text-indigo-500/70 shrink-0 w-[50px]">0x{str.offset.toString(16).padStart(4, '0')}</span>
                                    <span className="text-[10px] text-emerald-400/90 font-mono break-all">{str.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Right Column: Hex Dump Viewer */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0E]">
                          <div className="bg-indigo-950/30 border-b border-indigo-500/20 px-4 py-1.5 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-bold tracking-widest text-indigo-300">RAW HEXADECIMAL DUMP (512 BYTES)</span>
                          </div>
                          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <pre className="text-[11px] md:text-[12px] text-indigo-100/80 font-mono whitespace-pre w-full pointer-events-none">
                              {forensicData.analysis.hex_dump || 'ERROR: Hex buffer totally empty or corrupted.'}
                            </pre>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2">
                        <AlertTriangle className="h-6 w-6" />
                        <span className="text-[12px]">Forensic analysis failed to extract file headers.</span>
                      </div>
                    )}
                  </div>

                </DialogContent>
              </Dialog>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT PANEL — Tabbed ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Tab bar */}
          <div className="border-b border-border/30 px-4 flex flex-wrap items-end gap-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-3 text-[12px] font-semibold border-b-2 whitespace-nowrap transition-all duration-200',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
                  )}>
                  <Icon className={cn('h-3.5 w-3.5', isActive && 'text-primary')} strokeWidth={1.8} />
                  {tab.label}
                  <span className={cn('text-[8px] font-bold uppercase px-1 py-0.5 rounded border', tab.badgeColor)}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: macEase }}
                className="h-full">

                {/* ── CUSTODY TAB ─────────────────────────────── */}
                {activeTab === 'custody' && (
                  <div className="p-4 space-y-3">
                    {/* Legal layer notice */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={1.8} />
                      <span><strong className="text-foreground">Immutable legal record</strong> — SHA-256 hash-chained, court-admissible, tamper-evident</span>
                    </div>

                    {custodyLoading ? (
                      <div className="flex items-center justify-center py-12 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-[12px] text-muted-foreground">Loading custody chain…</span>
                      </div>
                    ) : custodyChain.length === 0 ? (
                      <div className="text-center py-12">
                        <FileLock2 className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-[12px] text-muted-foreground">No custody events recorded yet</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gradient-to-b from-amber-500/40 via-border/30 to-transparent" />
                        <div className="space-y-2">
                          {custodyChain.map((event: any, idx: number) => {
                            const config = CUSTODY_ACTIONS[event.action] || defaultCustody;
                            const Icon = config.icon;
                            const isFirst = idx === 0;
                            const isLatest = idx === custodyChain.length - 1;
                            const isExpanded = expandedNode === (event.event_id || String(idx));
                            return (
                              <div key={event.event_id || idx} className="relative flex gap-3">
                                {/* Chain dot */}
                                <div className="relative z-10 mt-3 shrink-0">
                                  <div className={cn('h-[10px] w-[10px] rounded-full border-[2px] border-background',
                                    isFirst ? 'bg-amber-500' : 'bg-border')}
                                    style={{ boxShadow: '0 0 0 1.5px hsl(var(--background))' }} />
                                </div>

                                <div className="flex-1 mb-1">
                                  <div className={cn(
                                    'rounded-xl border p-3 transition-colors hover:bg-amber-500/3',
                                    isFirst ? 'border-amber-500/20 bg-amber-500/3' : 'border-border/30 bg-background/40'
                                  )}>
                                    <div className="flex items-start gap-2.5">
                                      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0', config.bg)}>
                                        <Icon className={cn('h-3.5 w-3.5', config.color)} strokeWidth={1.8} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className="text-[12px] font-bold">{config.label}</span>
                                          {isFirst && <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded">Genesis</span>}
                                          {isLatest && !isFirst && <span className="text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 px-1.5 py-0.5 rounded">Latest</span>}
                                          <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/40"><Lock className="h-2.5 w-2.5" />Immutable</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{event.actor_name || 'System'}</span>
                                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(event.timestamp)}</span>
                                        </div>
                                        {/* Hash chain */}
                                        {event.event_hash && (
                                          <div className="flex items-center gap-1.5 text-[10px]">
                                            <span className="text-muted-foreground/50 w-[55px] shrink-0">Hash</span>
                                            <div className="flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/15 rounded-md px-2 py-0.5 flex-1">
                                              <Hash className="h-2.5 w-2.5 text-emerald-500/50 shrink-0" />
                                              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px] truncate">{truncHash(event.event_hash)}</span>
                                              <button onClick={() => copyHash(event.event_hash, 'hash')}
                                                className="ml-auto shrink-0 text-muted-foreground/40 hover:text-muted-foreground">
                                                <Copy className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                        {event.previous_event_hash && (
                                          <div className="flex items-center gap-1.5 text-[10px] mt-1">
                                            <span className="text-muted-foreground/50 w-[55px] shrink-0">Prev</span>
                                            <span className="font-mono text-muted-foreground/40 text-[9px]">{truncHash(event.previous_event_hash)}</span>
                                          </div>
                                        )}
                                      </div>
                                      {/* Per-row integrity */}
                                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                                        event.hash_mismatch ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20')}>
                                        {event.hash_mismatch ? '✗' : '✓'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TIMELINE TAB ─────────────────────────────── */}
                {activeTab === 'timeline' && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" strokeWidth={1.8} />
                      <span><strong className="text-foreground">Operational history</strong> — all evidence actions: uploads, accesses, edits, verifications</span>
                    </div>

                    {timelineLoading ? (
                      <div className="flex items-center justify-center py-12 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-[12px] text-muted-foreground">Loading timeline…</span>
                      </div>
                    ) : timelineEvents.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-[12px] text-muted-foreground">No timeline events for this evidence</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gradient-to-b from-blue-500/30 via-border/20 to-transparent" />
                        <div className="space-y-2">
                          {timelineEvents.map((event: any, idx: number) => {
                            const config = TIMELINE_ACTIONS[event.action] || defaultTimeline;
                            const Icon = config.icon;
                            const ok = (event.status_code || 200) < 400;
                            return (
                              <div key={event.log_id || idx} className="relative flex gap-3">
                                <div className="relative z-10 mt-3 shrink-0">
                                  <div className={cn('h-[10px] w-[10px] rounded-full border-[2px] border-background',
                                    ok ? 'bg-blue-500/80' : 'bg-red-500/80')}
                                    style={{ boxShadow: '0 0 0 1.5px hsl(var(--background))' }} />
                                </div>
                                <div className="flex-1 mb-1">
                                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border/25 bg-background/40 hover:bg-blue-500/3 transition-colors">
                                    <Icon className={cn('h-4 w-4 shrink-0', config.color)} strokeWidth={1.8} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[12px] font-bold">{config.label}</span>
                                        <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded border',
                                          ok ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20')}>
                                          {event.status_code || 200}
                                        </span>
                                        <span className="ml-auto text-[9px] font-mono text-muted-foreground/50">{fmtTime(event.timestamp)}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        {event.actor_name || 'System'}
                                        {event.response_time_ms && <span className="text-muted-foreground/40">{event.response_time_ms}ms</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── ACTIVITY TAB ─────────────────────────────── */}
                {activeTab === 'activity' && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[11px] text-muted-foreground">
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" strokeWidth={1.8} />
                      <span><strong className="text-foreground">Behavioral analytics</strong> — who accessed this evidence and how often</span>
                    </div>

                    {activityStats.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-[12px] text-muted-foreground">No activity data for this evidence</p>
                      </div>
                    ) : (
                      <Card className="mac-card">
                        <div className="px-3 py-2.5 border-b border-border/25">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Access by User</span>
                        </div>
                        <div className="divide-y divide-border/20">
                          {activityStats.map(([uid, stat], idx) => {
                            const max = activityStats[0]?.[1].count || 1;
                            const errorRate = stat.count > 0 ? stat.errors / stat.count : 0;
                            return (
                              <div key={uid} className="px-3 py-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                                      {stat.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="text-[12px] font-semibold">{stat.name}</span>
                                    {stat.errors > 0 && (
                                      <span className="text-[9px] text-red-500 font-bold">{stat.errors} err</span>
                                    )}
                                  </div>
                                  <span className="text-[12px] font-bold">{stat.count}</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted/60 overflow-hidden mt-1">
                                  <motion.div
                                    className="h-full rounded-full bg-emerald-500/60"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(stat.count / max) * 100}%` }}
                                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                                  />
                                </div>
                                {stat.errors > 0 && (
                                  <div className="h-1 rounded-full overflow-hidden mt-0.5 bg-muted/30">
                                    <motion.div className="h-full rounded-full bg-red-500/50"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${errorRate * 100}%` }}
                                      transition={{ duration: 0.4, delay: idx * 0.06 }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    )}

                    {/* Quick facts */}
                    <div className="flex flex-wrap lg:flex-nowrap gap-3">
                      {[
                        { label: 'Total Accesses', value: timelineEvents.length + allLogs.length, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { label: 'Unique Users', value: activityStats.length, icon: User, color: 'text-primary', bg: 'bg-primary/10' },
                        { label: 'Error Events', value: [...timelineEvents, ...allLogs].filter((l: any) => (l.status_code || 200) >= 400).length, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
                      ].map((s) => (
                        <Card key={s.label} className="flex-1 min-w-[120px] stat-card shadow-sm border-border/50">
                          <CardContent className="p-3">
                            <div className={cn('flex items-center justify-center h-6 w-6 rounded-lg mb-2', s.bg)}>
                              <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.8} />
                            </div>
                            <p className="text-[16px] font-extrabold leading-none">{s.value}</p>
                            <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">{s.label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── LOGS TAB ─────────────────────────────────── */}
                {activeTab === 'logs' && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-500/5 border border-slate-500/15 text-[11px] text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" strokeWidth={1.8} />
                      <span><strong className="text-foreground">Raw system logs</strong> — all API calls touching this evidence, including HTTP methods, status codes, and response times</span>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                      <input type="text" placeholder="Filter logs…"
                        value={logSearch} onChange={(e) => setLogSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 text-[12px] bg-background border border-border/50 rounded-lg outline-none focus:border-primary/50 transition-colors" />
                    </div>

                    {auditLoading ? (
                      <div className="flex items-center justify-center py-12 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-[12px] text-muted-foreground">Loading logs…</span>
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-[12px] text-muted-foreground">No system logs for this evidence</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/30 overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-[80px_1fr_80px_70px_80px] gap-2 px-3 py-2 bg-muted/30 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30">
                          <span>Method</span>
                          <span>Action / Endpoint</span>
                          <span>Actor</span>
                          <span>Status</span>
                          <span className="text-right">Time</span>
                        </div>
                        <div className="divide-y divide-border/15">
                          {filteredLogs.slice(0, 50).map((log: any, idx: number) => {
                            const ok = (log.status_code || 200) < 400;
                            return (
                              <div key={log.log_id || idx}
                                className="grid grid-cols-[80px_1fr_80px_70px_80px] gap-2 px-3 py-2 hover:bg-muted/10 transition-colors items-center text-[10px]">
                                <span className={cn('font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border text-center',
                                  log.method === 'GET' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    : log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : log.method === 'DELETE' ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                )}>
                                  {log.method || 'GET'}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{log.action?.replace(/:/g, ' › ') || 'API Call'}</p>
                                  <p className="font-mono text-muted-foreground/50 text-[9px] truncate">{log.endpoint}</p>
                                </div>
                                <span className="text-muted-foreground truncate">{log.actor_name || 'System'}</span>
                                <span className={cn('font-bold text-[9px] px-1 py-0.5 rounded border text-center',
                                  ok ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20')}>
                                  {log.status_code || 200}
                                </span>
                                <span className="text-muted-foreground/50 text-right font-mono text-[9px]">
                                  {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {filteredLogs.length > 50 && (
                          <div className="px-3 py-2 border-t border-border/25 text-[10px] text-muted-foreground/50 text-center">
                            Showing 50 of {filteredLogs.length} logs
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceDetailPage;
