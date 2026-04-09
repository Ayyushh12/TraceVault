/**
 * Risk Intelligence Dashboard
 * Powered by deterministic rule engine — no fake AI labels
 *
 * Layout:
 *   Header → Overall threat banner
 *   Risk Distribution (4 level bars)
 *   Anomaly feed (rule-triggered alerts)
 *   Top risky evidence + Suspicious users side-by-side
 *   Duplicate detection
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, FileText, Link2, Clock, Monitor,
  User, Users, Hash, GitBranch, Lock, Activity, RefreshCw,
  ChevronRight, CheckCircle2, XCircle, Info, Layers, Fingerprint,
  BarChart2, ShieldOff, Eye, Download, Network, Server,
} from 'lucide-react';
import { useThreatDashboard, useAnomalies, useDuplicates } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

const ease = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Severity config ──────────────────────────────────────────────
const SEV: Record<string, { label: string; text: string; bg: string; border: string; dot: string }> = {
  critical: { label: 'Critical', text: 'text-red-600 dark:text-red-400',    bg: 'bg-red-500/8 dark:bg-red-500/10', border: 'border-red-500/25', dot: 'bg-red-500' },
  high:     { label: 'High',     text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/8 dark:bg-orange-500/10', border: 'border-orange-500/25', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/8 dark:bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-500' },
  low:      { label: 'Low',      text: 'text-emerald-600 dark:text-emerald-500', bg: 'bg-emerald-500/8 dark:bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-500' },
};

// ── Anomaly type icons & labels ───────────────────────────────────
const ANOMALY_CFG: Record<string, { icon: typeof Activity; label: string }> = {
  off_hours_access:      { icon: Clock,      label: 'Off-Hours Access' },
  mass_evidence_access:  { icon: Network,    label: 'Mass Bulk Access' },
  brute_force_attempt:   { icon: Lock,       label: 'Brute Force Login' },
  rapid_custody_changes: { icon: GitBranch,  label: 'Rapid Custody Changes' },
  failed_login:          { icon: AlertCircle, label: 'Auth Failure Spike' },
  hash_mismatch:         { icon: Hash,       label: 'Hash Mismatch' },
};

// ── Risk bar ─────────────────────────────────────────────────────
const RiskBar = ({ label, value, total, color }: any) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <motion.div className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease }} />
      </div>
    </div>
  );
};

// ── Anomaly row ───────────────────────────────────────────────────
const AnomalyRow = ({ anomaly }: { anomaly: any }) => {
  const sev = SEV[anomaly.severity] || SEV.low;
  const cfg = ANOMALY_CFG[anomaly.type] || { icon: AlertCircle, label: anomaly.type };
  const Icon = cfg.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border transition-colors', sev.bg, sev.border)}>
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5',
        anomaly.severity === 'critical' ? 'bg-red-500/15' :
        anomaly.severity === 'high'     ? 'bg-orange-500/15' :
        anomaly.severity === 'medium'   ? 'bg-amber-500/15' : 'bg-emerald-500/15')}>
        <Icon className={cn('h-3.5 w-3.5', sev.text)} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[11px] font-bold">{cfg.label}</span>
          <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', sev.text, sev.border)}>
            {sev.label}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{anomaly.description}</p>
        {anomaly.rule && (
          <p className="mt-1 font-mono text-[9px] text-muted-foreground/40 truncate">{anomaly.rule}</p>
        )}
      </div>
      <div className="text-[9px] text-muted-foreground/50 whitespace-nowrap shrink-0">
        {anomaly.detected_at ? formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true }) : '—'}
      </div>
    </div>
  );
};

// ── Risk score pill ───────────────────────────────────────────────
const RiskPill = ({ score, level }: { score: number; level: string }) => {
  const sev = SEV[level] || SEV.low;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', sev.text, sev.bg, sev.border)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
      {score}
    </span>
  );
};

// ── Overall threat banner ─────────────────────────────────────────
const ThreatBanner = ({ level, anomalyCount, criticalAlerts, rulesEvaluated }: any) => {
  const sev = SEV[level] || SEV.low;
  const threatLabel = level === 'critical' ? 'Critical Threats Detected'
    : level === 'high' ? 'High Risk Activity'
    : level === 'medium' ? 'Moderate Anomalies'
    : 'System Status Normal';

  return (
    <Card className={cn('mac-card border-2 overflow-hidden', sev.border)}>
      <div className={cn('px-5 py-4 flex items-center gap-4', sev.bg)}>
        <div className={cn('flex items-center justify-center h-11 w-11 rounded-xl shrink-0',
          level === 'critical' ? 'bg-red-500/20' :
          level === 'high'     ? 'bg-orange-500/20' :
          level === 'medium'   ? 'bg-amber-500/20' : 'bg-emerald-500/15')}>
          {level === 'low'
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" strokeWidth={1.6} />
            : <AlertTriangle className={cn('h-5 w-5', sev.text)} strokeWidth={1.6} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[15px] font-extrabold">{threatLabel}</span>
            <Badge className={cn('text-[9px] font-bold uppercase', sev.text, sev.bg, sev.border)} variant="outline">
              {level.toUpperCase()}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {anomalyCount} anomalies detected · {criticalAlerts} critical · {rulesEvaluated} rules evaluated
          </p>
        </div>
        <div className="text-right text-[10px] text-muted-foreground/60 shrink-0">
          <p className="font-bold text-[11px]">Rule Engine v2</p>
          <p>Deterministic · No AI</p>
        </div>
      </div>
    </Card>
  );
};

// ── Main Page ─────────────────────────────────────────────────────
const ThreatIntelPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'anomalies' | 'duplicates'>('anomalies');

  const { data: threatData, isLoading, refetch, isFetching } = useThreatDashboard();
  const { data: anomalyData } = useAnomalies();
  const { data: dupeData } = useDuplicates();

  const d = threatData?.data || threatData || {};
  const anomalies = (anomalyData?.data?.anomalies ?? anomalyData?.anomalies ?? d.anomalies) || [];
  const riskDist = d.risk_distribution || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  const topRisks = d.top_risks || [];
  const suspiciousUsers = d.suspicious_users || [];
  const dupes = dupeData?.data?.exact_duplicates ?? dupeData?.exact_duplicates ?? [];

  const overallLevel = d.overall_threat_level || 'low';

  const anomalyStats = useMemo(() => {
     let c = 0, h = 0, m = 0, l = 0;
     anomalies.forEach((a: any) => {
         if (a.severity === 'critical') c++;
         else if (a.severity === 'high') h++;
         else if (a.severity === 'medium') m++;
         else l++;
     });
     return { critical: c, high: h, medium: m, low: l };
  }, [anomalies]);

  return (
    <div className="page-container space-y-5 pb-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Risk Intelligence</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Rule-based anomaly detection · Evidence risk scoring · Correlation engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/30">
            <Server className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.8} />
            <span className="text-[10px] font-bold text-muted-foreground/60">Rule Engine · {d.rules_evaluated || 15} rules</span>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} /> Scan
          </Button>
        </div>
      </motion.div>

      {/* Threat banner */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.25, ease }}>
        <ThreatBanner
          level={overallLevel}
          anomalyCount={d.anomaly_count || 0}
          criticalAlerts={d.critical_alerts || 0}
          rulesEvaluated={d.rules_evaluated || 15}
        />
      </motion.div>

      {/* 4-column metrics (Anomaly Data, not Evidence Data) */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.25, ease }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Critical Threats',  value: anomalyStats.critical, icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-500/10' },
          { label: 'High Priority', value: anomalyStats.high,    icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Medium Alerts',    value: anomalyStats.medium,  icon: AlertCircle,   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
          { label: 'Low / Minor',  value: anomalyStats.low,     icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.22, ease }}>
            <Card className="mac-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', s.bg)}>
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.7} />
                  </div>
                </div>
                <p className="text-[22px] font-extrabold tracking-tight leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1 font-medium">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Risk distribution + Top risks */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Risk distribution bar chart */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.25, ease }} className="lg:col-span-2">
          <Card className="mac-card h-full">
            <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[12px] font-bold">Risk Distribution</span>
            </div>
            <CardContent className="p-4 space-y-3">
              <RiskBar label="Critical" value={riskDist.critical || 0} total={riskDist.total || 1} color="bg-red-500" />
              <RiskBar label="High"     value={riskDist.high    || 0} total={riskDist.total || 1} color="bg-orange-500" />
              <RiskBar label="Medium"   value={riskDist.medium  || 0} total={riskDist.total || 1} color="bg-amber-500" />
              <RiskBar label="Low"      value={riskDist.low     || 0} total={riskDist.total || 1} color="bg-emerald-500" />
              <div className="border-t border-border/20 pt-2.5">
                <p className="text-[10px] text-muted-foreground">
                  Total evidence scored: <span className="font-bold text-foreground">{riskDist.total || 0}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top risky evidence */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.25, ease }} className="lg:col-span-3">
          <Card className="mac-card h-full">
            <div className="px-4 py-3 border-b border-border/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Highest Risk Evidence</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground"
                onClick={() => navigate('/evidence')}>
                View All <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
            <div className="divide-y divide-border/20">
              {topRisks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500/40 mb-2" />
                  <p className="text-[12px] text-muted-foreground">No high-risk evidence found</p>
                </div>
              ) : topRisks.map((ev: any, i: number) => (
                <div key={ev.evidence_id || i}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/evidence/${ev.evidence_id}`)}>
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted/50 shrink-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate group-hover:text-primary transition-colors">
                      {ev.file_name || 'Evidence'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.integrity_status === 'tampered' ? '⚠ Tampered' : `${ev.access_count || 0} accesses`}
                    </p>
                  </div>
                  <RiskPill score={ev.risk_score} level={ev.risk_level} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Anomalies + Suspicious Users */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Anomaly feed */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.25, ease }} className="lg:col-span-3">
          <Card className="mac-card">
            <div className="px-4 py-3 border-b border-border/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                <span className="text-[12px] font-bold">Active Anomalies</span>
                {anomalies.length > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {anomalies.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <Info className="h-3 w-3" />
                Rule-triggered · no AI
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {anomalies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500/40 mb-2" />
                  <p className="text-[12px] text-muted-foreground">No anomalies detected</p>
                </div>
              ) : anomalies.map((a: any, i: number) => (
                <AnomalyRow key={a.anomaly_id || i} anomaly={a} />
              ))}
            </div>

            {/* Rule reference */}
            <div className="px-4 py-2.5 border-t border-border/20 bg-muted/20">
              <p className="text-[9px] font-mono text-muted-foreground/40">
                Rules: off-hours access · mass bulk access · brute-force · rapid custody changes · hash mismatch · 401/403 spike
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Suspicious users + Duplicates */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.25, ease }} className="lg:col-span-2 space-y-4">

          {/* Suspicious users */}
          <Card className="mac-card">
            <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[12px] font-bold">Suspicious Users</span>
            </div>
            <div className="divide-y divide-border/20">
              {suspiciousUsers.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-4 w-4 mx-auto text-muted-foreground/30 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground">No suspicious activity</p>
                </div>
              ) : suspiciousUsers.map((u: any, i: number) => (
                <div key={u._id || i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-orange-500/10 shrink-0">
                    <User className="h-3.5 w-3.5 text-orange-500" strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate">{u.actor_name || u._id?.slice(0, 12) || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground">{u.error_count} security blocks in 24h</p>
                  </div>
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                    {u.error_count}×
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Duplicates */}
          <Card className="mac-card">
            <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2">
              <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[12px] font-bold">Duplicate Evidence</span>
            </div>
            <div className="divide-y divide-border/20">
              {dupes.length === 0 ? (
                <div className="text-center py-6">
                  <Fingerprint className="h-4 w-4 mx-auto text-muted-foreground/30 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground">No exact duplicates</p>
                </div>
              ) : dupes.slice(0, 4).map((g: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-semibold truncate flex-1 mr-2">
                      {g.items?.[0]?.name || 'Evidence group'}
                    </p>
                    <span className="text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                      {g.count}× copies
                    </span>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground/40 truncate">
                    {g._id?.slice(0, 24)}…
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ThreatIntelPage;
