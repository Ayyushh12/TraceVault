/**
 * VerifyPage — Industry-Grade Integrity Verification Dashboard
 *
 * Shows the complete multi-level verification report:
 *   L1 — SHA-256
 *   L2 — Multi-hash (SHA-256 + SHA-1 + MD5) + Trusted Timestamp
 *   L3 — Chunk comparison + Merkle Root + Fuzzy Similarity
 *
 * Visual layout:
 *   Header → Evidence selector → Run button
 *   ↓
 *   Overall verdict (pass/fail badge)
 *   ↓
 *   4 Method cards: Multi-hash | Chunks | Merkle | Timestamp
 *   ↓
 *   Chunk map (heat grid showing tampered vs intact)
 *   ↓
 *   Fuzzy similarity meter
 *   ↓
 *   Full JSON report panel
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldX, Shield, Fingerprint, Hash, Clock,
  ChevronRight, ArrowLeft, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Lock, BarChart2, Binary, GitBranch, Search,
  FileText, Layers, Zap, RefreshCw, Info, Network, Copy, HelpCircle,
} from 'lucide-react';
import { useVerifyEvidence, useEvidenceDetail, useEvidenceList } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ── Type helpers ─────────────────────────────────────────────────
type VerifyResult = {
  evidence_id: string;
  file_name: string;
  file_size: number;
  verification_time: string;
  overall_result: 'pass' | 'fail';
  file_accessible: boolean;
  methods_run: string[];
  multi_hash?: {
    valid: boolean;
    mode: string;
    sha256: { stored: string; computed?: string; match: boolean | null };
    sha1:   { stored: string; computed?: string; match: boolean | null };
    md5:    { stored: string; computed?: string; match: boolean | null };
    mismatches?: string[];
  };
  chunk_verification?: {
    valid: boolean;
    total_chunks: number;
    intact_chunks: number;
    tampered_count: number;
    tampered_chunks: { chunk_index: number; start_byte: number; end_byte: number; size_bytes: number }[];
    tampered_byte_ranges?: { chunk_index: number; start_byte: number; end_byte: number }[];
  };
  merkle_verification?: {
    valid: boolean;
    stored_root: string;
    computed_root: string;
    leaf_count: number;
  };
  timestamp_verification?: {
    valid: boolean;
    timestamp: string;
    server_id: string;
    error?: string;
  };
  fuzzy_hash?: {
    stored: string;
    current: string;
    similarity_score: number;
    suspicious: boolean;
  };
  forensic_analysis?: {
    entropy: {
      score: number;
      risk: 'low' | 'medium' | 'high' | 'critical';
      label: string;
    };
    signature: {
      valid: boolean;
      mismatch: boolean;
      expected: string;
      actual: string;
    };
  };
};

// ── Helpers ──────────────────────────────────────────────────────
function truncH(h?: string, n = 18) { return h ? `${h.slice(0, n)}…` : '—'; }
function fmtBytes(b: number) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ── Match badge ──────────────────────────────────────────────────
const MatchBadge = ({ match }: { match: boolean | null }) => {
  if (match === null) return <span className="text-[9px] text-muted-foreground/50 font-mono">N/A</span>;
  return match
    ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded"><CheckCircle2 className="h-3 w-3" /> Match</span>
    : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded"><XCircle className="h-3 w-3" /> Mismatch</span>;
};

// ── Hash row ─────────────────────────────────────────────────────
const HashRow = ({ algo, stored, computed, match }: any) => (
  <div className="grid grid-cols-[60px_1fr_1fr_80px] gap-2 items-center py-2 border-b border-border/20 last:border-0 group">
    <span className="font-mono text-[10px] font-bold text-muted-foreground">{algo}</span>
    <div className="min-w-0">
      <p className="text-[9px] text-muted-foreground/50 mb-0.5">Stored</p>
      <p className="font-mono text-[9px] text-muted-foreground truncate">{truncH(stored, 22)}</p>
    </div>
    <div className="min-w-0">
      <p className="text-[9px] text-muted-foreground/50 mb-0.5">Computed</p>
      <p className={cn('font-mono text-[9px] truncate', match === false ? 'text-red-400' : 'text-muted-foreground')}>
        {computed ? truncH(computed, 22) : '—'}
      </p>
    </div>
    <div className="flex justify-end"><MatchBadge match={match} /></div>
  </div>
);

// ── Method card wrapper ──────────────────────────────────────────
const MethodCard = ({ icon: Icon, title, badge, badgeColor, valid, note, children }: any) => (
  <Card className={cn('mac-card border', valid === true ? 'border-emerald-500/20' : valid === false ? 'border-red-500/20' : 'border-border/30')}>
    <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2.5">
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0',
        valid === true ? 'bg-emerald-500/10' : valid === false ? 'bg-red-500/10' : 'bg-muted/50')}>
        <Icon className={cn('h-3.5 w-3.5', valid === true ? 'text-emerald-500' : valid === false ? 'text-red-500' : 'text-muted-foreground')} strokeWidth={1.8} />
      </div>
      <span className="text-[12px] font-bold flex-1">{title}</span>
      {badge && <span className={cn('text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border', badgeColor)}>{badge}</span>}
      {valid !== undefined && valid !== null && (
        valid === true
          ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</span>
          : <span className="flex items-center gap-1 text-[10px] font-bold text-red-600"><XCircle className="h-3.5 w-3.5" /> Fail</span>
      )}
      {note && <span className="text-[9px] text-muted-foreground">{note}</span>}
    </div>
    <div className="p-4">{children}</div>
  </Card>
);

// ── Chunk heat grid ──────────────────────────────────────────────
const ChunkHeatGrid = ({ total, tampered }: { total: number; tampered: number[] }) => {
  const display = Math.min(total, 160); // max 160 cells
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-2">
        Chunk map — each cell = 4 MB block. <span className="text-emerald-500">■</span> Intact &nbsp;<span className="text-red-500">■</span> Tampered
      </p>
      <div className="flex flex-wrap gap-[3px]">
        {Array.from({ length: display }, (_, i) => (
          <div key={i}
            title={`Chunk ${i} — ${tampered.includes(i) ? 'TAMPERED' : 'Intact'}`}
            className={cn(
              'h-3 w-3 rounded-[2px] transition-colors',
              tampered.includes(i) ? 'bg-red-500' : 'bg-emerald-500/60'
            )} />
        ))}
        {total > 160 && (
          <span className="text-[9px] text-muted-foreground self-end ml-1">+{total - 160} more</span>
        )}
      </div>
    </div>
  );
};

// ── Similarity meter ─────────────────────────────────────────────
const SimilarityMeter = ({ score }: { score: number }) => {
  const color = score >= 95 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold">File Similarity Score</span>
        <span className={cn('text-[14px] font-extrabold', score >= 95 ? 'text-emerald-500' : score >= 80 ? 'text-amber-500' : 'text-red-500')}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
        <motion.div className={cn('h-full rounded-full', color)} initial={{ width: 0 }}
          animate={{ width: `${score}%` }} transition={{ duration: 0.6 }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        {score >= 95 ? '✓ Identical to original — no modifications detected'
          : score >= 80 ? '⚠ Minor differences detected — possible metadata changes'
            : '✗ Significant changes — file may be substantially altered'}
      </p>
    </div>
  );
};

// ── Forensic Analysis Card ──────────────────────────────────────
const ForensicAnalysisCard = ({ analysis }: { analysis: VerifyResult['forensic_analysis'] }) => {
  if (!analysis) return null;
  const { entropy, signature } = analysis;

  return (
    <Card className="mac-card border-border/30">
      <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2.5 bg-blue-500/5">
        <Zap className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.8} />
        <span className="text-[12px] font-bold flex-1">Deep Forensic Analysis</span>
        <Badge variant="outline" className="text-[8px] bg-blue-500/10 text-blue-600 border-blue-500/20">AI ENHANCED</Badge>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entropy Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Binary className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Shannon Entropy</span>
            </div>
            <Badge className={cn(
              'text-[10px] font-bold',
              entropy.risk === 'critical' ? 'bg-red-600' : 
              entropy.risk === 'high' ? 'bg-amber-600' : 
              entropy.risk === 'medium' ? 'bg-blue-600' : 
              'bg-emerald-600'
            )}>
              {entropy.score} bits
            </Badge>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <motion.div 
              className={cn('h-full', 
                entropy.risk === 'critical' ? 'bg-red-500' : 
                entropy.risk === 'high' ? 'bg-amber-500' : 
                entropy.risk === 'medium' ? 'bg-blue-500' : 
                'bg-emerald-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${(entropy.score / 8) * 100}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <Info className="h-3 w-3 mt-0.5 text-blue-500" />
            <p className="text-[10px] text-muted-foreground leading-tight">
              {entropy.label}. High entropy ({entropy.score}) suggests the file may contain encrypted data or hidden payloads.
            </p>
          </div>
        </div>

        {/* Signature Verification */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Magic Byte Analysis</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/20">
              <div className="space-y-0.5">
                <p className="text-[9px] text-muted-foreground uppercase">Expected (Magic)</p>
                <p className="font-mono text-[11px]">{signature.expected || 'Unknown'}</p>
              </div>
              <div className="h-8 w-[1px] bg-border/40 mx-2" />
              <div className="space-y-0.5 text-right">
                <p className="text-[9px] text-muted-foreground uppercase">Actual (Header)</p>
                <p className={cn('font-mono text-[11px]', signature.valid ? 'text-emerald-500' : 'text-red-500')}>
                  {signature.actual || 'N/A'}
                </p>
              </div>
            </div>
            {!signature.valid ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <p className="text-[10px] text-red-600 font-bold">
                  SPOOFING DETECTED: File header does not match extension. This may be an executable disguised as an image.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] text-emerald-600 font-bold font-mono">
                  SIGNATURE VALID: Extension matches file header.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ── Main page ────────────────────────────────────────────────────
const VerifyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<VerifyResult | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: evidenceData } = useEvidenceDetail(id || '');
  const evidence = evidenceData?.evidence || evidenceData;

  const verifyMutation = useVerifyEvidence();

  const runVerification = () => {
    if (!id) return;
    verifyMutation.mutate(id, {
      onSuccess: (data: any) => {
        const result = data?.data || data;
        setReport(result);
        toast({
          title: result?.overall_result === 'pass' ? '✓ Integrity Confirmed' : '⚠ Tampering Detected',
          description: result?.overall_result === 'pass'
            ? `All ${result.methods_run?.length} verification methods passed.`
            : `Integrity failure detected across ${result.multi_hash?.mismatches?.length || 1} hash algorithms.`,
          variant: result?.overall_result === 'pass' ? 'default' : 'destructive',
        });
      },
      onError: () => {
        toast({ title: 'Verification Failed', description: 'Backend returned an error.', variant: 'destructive' });
      },
    });
  };

  const copyJson = () => {
    if (!report) return;
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isPassed = report?.overall_result === 'pass';

  return (
    <div className="max-w-[960px] mx-auto px-4 py-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] font-black tracking-tight uppercase italic text-primary">Forensic Verification</h1>
            <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/5">{id ? id.slice(0, 16) : 'Select Evidence'}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Blockchain-backed integrity audit for TraceVault digital assets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runVerification} disabled={verifyMutation.isPending || !id} size="sm" className="h-9 px-4 font-bold shadow-lg shadow-primary/20">
            {verifyMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Bitstream…</>
              : <><RefreshCw className="mr-2 h-4 w-4" /> Start Audit Pipeline</>}
          </Button>
        </div>
      </div>

      {/* ── Evidence Selector ─────────────────────────────────── */}
      {!id && (
        <Card className="mac-card border-dashed bg-muted/30">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[16px] font-bold">No Evidence Selected</h3>
              <p className="text-[12px] text-muted-foreground max-w-[300px]">
                Please select an evidence item from the repository to run the verification pipeline.
              </p>
            </div>
            <div className="w-full max-w-[400px]">
              <EvidenceListSelector onSelect={(evId) => navigate(`/verify/${evId}`)} />
            </div>
          </CardContent>
        </Card>
      )}

      {id && evidence && (
        <Card className="mac-card bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold">{evidence.original_name}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-mono">{evidence.file_hash?.slice(0, 32)}…</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black">{fmtBytes(evidence.file_size)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight">{evidence.mime_type}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Method legend ──────────────────────────────────────── */}
      {!report && !verifyMutation.isPending && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Hash,      label: 'Level 1 & 2',  desc: 'SHA-256 · SHA-1 · MD5',              color: 'text-primary',     bg: 'bg-primary/10' },
            { icon: Layers,    label: 'Level 3 — Chunks',  desc: '4 MB blocks · Byte-range tamper localization', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { icon: GitBranch, label: 'Level 3 — Merkle', desc: 'Root hash · Cryptographic proof',  color: 'text-violet-500',  bg: 'bg-violet-500/10' },
          ].map((m) => (
            <Card key={m.label} className="mac-card">
              <CardContent className="p-3 flex items-start gap-3">
                <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5', m.bg)}>
                  <m.icon className={cn('h-3.5 w-3.5', m.color)} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[11px] font-bold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Running state ──────────────────────────────────────── */}
      {verifyMutation.isPending && (
        <Card className="mac-card border-border/30">
          <CardContent className="py-10 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-primary/30 animate-ping absolute inset-0" />
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center relative">
                <Shield className="h-5 w-5 text-primary animate-pulse" strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold mb-1">Running Forensic Verification</p>
              <p className="text-[11px] text-muted-foreground">SHA-256 · SHA-1 · MD5 · Chunk comparison · Merkle tree · Fuzzy hash…</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
              <Loader2 className="h-3 w-3 animate-spin" />
              This may take a few seconds for large files
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Full report ────────────────────────────────────────── */}
      <AnimatePresence>
        {report && (
          <motion.div key="report" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {/* Verdict Banner */}
            <Card className={cn('mac-card overflow-hidden border-2',
              isPassed ? 'border-emerald-500/30' : 'border-red-500/30')}>
              <div className={cn('px-5 py-4 flex items-center gap-4',
                isPassed ? 'bg-emerald-500/5' : 'bg-red-500/5')}>
                <div className={cn('flex items-center justify-center h-12 w-12 rounded-xl shrink-0',
                  isPassed ? 'bg-emerald-500/15' : 'bg-red-500/15')}>
                  {isPassed
                    ? <ShieldCheck className="h-6 w-6 text-emerald-500" strokeWidth={1.5} />
                    : <ShieldX className="h-6 w-6 text-red-500" strokeWidth={1.5} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[16px] font-extrabold">
                      {isPassed ? 'Integrity Confirmed' : 'Integrity Violation Detected'}
                    </span>
                    <Badge className={isPassed ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}>
                      {isPassed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {`${report.methods_run?.length || 0} methods run · ${format(new Date(report.verification_time), 'MMM d, yyyy HH:mm:ss')}`}
                    {!report.file_accessible && ' · Hash-only mode (file not accessible)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {report.verification_time ? format(new Date(report.verification_time), 'HH:mm:ss') : '—'}
                </div>
              </div>
            </Card>

            {/* Deep Forensic Analysis Section */}
            <ForensicAnalysisCard analysis={report.forensic_analysis} />

            {/* Method cards grid */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* Multi-hash card */}
              <MethodCard icon={Hash} title="Multi-Hash Verification"
                badge="Level 1 & 2" badgeColor="bg-primary/10 text-primary border-primary/20"
                valid={report.multi_hash?.valid}>
                <HashRow algo="SHA-256" {...report.multi_hash?.sha256} />
                <HashRow algo="SHA-1"   {...report.multi_hash?.sha1} />
                <HashRow algo="MD5"     {...report.multi_hash?.md5} />
                {report.multi_hash?.mismatches && report.multi_hash.mismatches.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-[10px] text-red-600">
                      Hash mismatch in: {report.multi_hash.mismatches.join(', ')}
                    </span>
                  </div>
                )}
              </MethodCard>

              {/* Trusted Timestamp */}
              <MethodCard icon={Clock} title="Trusted Timestamp"
                badge="Level 2" badgeColor="bg-amber-500/10 text-amber-600 border-amber-500/20"
                valid={report.timestamp_verification?.valid ?? null}
                note={!report.timestamp_verification ? 'Not run' : undefined}>
                {report.timestamp_verification ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[80px_1fr] gap-1 text-[11px]">
                      <span className="text-muted-foreground/60">Issued at</span>
                      <span className="font-mono">{report.timestamp_verification.timestamp
                        ? format(new Date(report.timestamp_verification.timestamp), 'yyyy-MM-dd HH:mm:ss')
                        : '—'}</span>
                      <span className="text-muted-foreground/60">Authority</span>
                      <span className="font-mono">{report.timestamp_verification.server_id || '—'}</span>
                      <span className="text-muted-foreground/60">Signature</span>
                      <span>{report.timestamp_verification.valid
                        ? <span className="text-emerald-500 font-bold text-[10px]">✓ HMAC Verified</span>
                        : <span className="text-red-500 font-bold text-[10px]">✗ Signature Invalid</span>}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50 mt-1">
                      RFC 3161 simulation — HMAC-SHA256 signed by server key bound to file hash + ISO timestamp + nonce
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <HelpCircle className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
                    <p className="text-[11px] text-muted-foreground">Timestamp not stored — re-upload to enable</p>
                  </div>
                )}
              </MethodCard>

              {/* Chunk verification */}
              <MethodCard icon={Layers} title="Chunk-Level Verification"
                badge="Level 3" badgeColor="bg-blue-500/10 text-blue-600 border-blue-500/20"
                valid={report.chunk_verification?.valid ?? null}
                note={!report.chunk_verification ? 'Not run' : undefined}>
                {report.chunk_verification ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Total', value: report.chunk_verification.total_chunks, color: 'text-foreground' },
                        { label: 'Intact', value: report.chunk_verification.intact_chunks, color: 'text-emerald-500' },
                        { label: 'Tampered', value: report.chunk_verification.tampered_count, color: report.chunk_verification.tampered_count > 0 ? 'text-red-500' : 'text-muted-foreground' },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <p className={cn('text-[18px] font-extrabold', s.color)}>{s.value}</p>
                          <p className="text-[9px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <ChunkHeatGrid
                      total={report.chunk_verification.total_chunks}
                      tampered={report.chunk_verification.tampered_chunks?.map(c => c.chunk_index) || []}
                    />
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Layers className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
                    <p className="text-[11px] text-muted-foreground">Chunk hashes not available — re-upload to enable</p>
                  </div>
                )}
              </MethodCard>

              {/* Merkle tree */}
              <MethodCard icon={GitBranch} title="Merkle Tree Verification"
                badge="Level 3" badgeColor="bg-violet-500/10 text-violet-600 border-violet-500/20"
                valid={report.merkle_verification?.valid ?? null}
                note={!report.merkle_verification ? 'Not run' : undefined}>
                {report.merkle_verification ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[70px_1fr] gap-1 text-[11px]">
                      <span className="text-muted-foreground/60">Leaves</span>
                      <span className="font-bold">{report.merkle_verification.leaf_count} chunks</span>
                      <span className="text-muted-foreground/60">Stored root</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{truncH(report.merkle_verification.stored_root, 28)}</span>
                      <span className="text-muted-foreground/60">Computed</span>
                      <span className={cn('font-mono text-[9px]',
                        report.merkle_verification.valid ? 'text-emerald-500' : 'text-red-400')}>
                        {truncH(report.merkle_verification.computed_root, 28)}
                      </span>
                      <span className="text-muted-foreground/60">Result</span>
                      <span>
                        {report.merkle_verification.valid
                          ? <span className="text-emerald-500 font-bold text-[10px]">✓ Root Match</span>
                          : <span className="text-red-500 font-bold text-[10px]">✗ Root Mismatch</span>}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50">
                      Each leaf = SHA-256 of a 4 MB chunk. Parent = SHA-256(left+right). Root = single cryptographic proof.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <GitBranch className="h-5 w-5 mx-auto text-muted-foreground/30 mb-1.5" />
                    <p className="text-[11px] text-muted-foreground">Merkle root not stored — re-upload to enable</p>
                  </div>
                )}
              </MethodCard>
            </div>

            {/* Fuzzy similarity */}
            {report.fuzzy_hash && (
              <Card className={cn('mac-card border', report.fuzzy_hash.suspicious ? 'border-amber-500/20' : 'border-border/30')}>
                <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2.5">
                  <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg',
                    report.fuzzy_hash.suspicious ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                    <Network className={cn('h-3.5 w-3.5', report.fuzzy_hash.suspicious ? 'text-amber-500' : 'text-emerald-500')} strokeWidth={1.8} />
                  </div>
                  <span className="text-[12px] font-bold flex-1">Fuzzy Hash Similarity (ssdeep-style)</span>
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border bg-slate-500/10 text-slate-600 border-slate-500/20">Level 3</span>
                </div>
                <div className="p-4 space-y-3">
                  <SimilarityMeter score={report.fuzzy_hash.similarity_score} />
                  <div className="grid grid-cols-[60px_1fr] gap-1 text-[10px]">
                    <span className="text-muted-foreground/60">Stored</span>
                    <span className="font-mono text-[9px] text-muted-foreground truncate">{report.fuzzy_hash.stored}</span>
                    <span className="text-muted-foreground/60">Current</span>
                    <span className="font-mono text-[9px] text-muted-foreground truncate">{report.fuzzy_hash.current}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Raw JSON report */}
            <Card className="mac-card border-border/30">
              <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold flex-1">Full Verification Report</span>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={copyJson}>
                  {copied ? <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
                  Copy JSON
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowJson(v => !v)}>
                  {showJson ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              <AnimatePresence>
                {showJson && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <pre className="p-4 text-[10px] font-mono text-green-400 bg-black/90 rounded-b-xl overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
                      {JSON.stringify(report, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Evidence Selector Component ─────────────────────────────────
const EvidenceListSelector = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const { data: evidenceList, isLoading } = useEvidenceList({ limit: 100 });
  const evidences = evidenceList?.evidences || (Array.isArray(evidenceList) ? evidenceList : []);

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />;

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select evidence to verify..." />
      </SelectTrigger>
      <SelectContent>
        {evidences.map((ev: any) => (
          <SelectItem key={ev.evidence_id || ev._id} value={ev.evidence_id || ev._id}>
            {ev.original_name} ({fmtBytes(ev.file_size)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default VerifyPage;
