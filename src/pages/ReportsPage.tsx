import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import {
  FileText, Download, Loader2, BarChart2, Plus, Calendar, Clock, ShieldCheck,
  FolderOpen, RefreshCw
} from 'lucide-react';
import { useEvidenceList, useCases, useGenerateReport } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const reportTypes = [
  {
    id: 'evidence',
    label: 'Evidence Report',
    desc: 'Detailed evidence metadata, hash, custody chain, and integrity status',
    icon: ShieldCheck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    id: 'case',
    label: 'Case Summary',
    desc: 'Overview of case details, linked evidence, and activity timeline',
    icon: FolderOpen,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'audit',
    label: 'Audit Trail',
    desc: 'Comprehensive audit log export with timestamps and actor info',
    icon: FileText,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
];

const ReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState<'evidence'|'case'|'audit'>('evidence');
  const [selectedEvidence, setSelectedEvidence] = useState('');
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'json'>('pdf');

  const { data: evidenceData, isLoading: evLoading } = useEvidenceList();
  const { data: casesData, isLoading: casesLoading } = useCases({ limit: 50 });
  const generateMutation = useGenerateReport();

  const evidence = useMemo(() => {
    const list = evidenceData?.evidences || evidenceData?.data?.evidences || (Array.isArray(evidenceData) ? evidenceData : []);
    return Array.isArray(list) ? list : [];
  }, [evidenceData]);

  const cases = useMemo(() => {
    const list = casesData?.cases || casesData?.data?.cases || (Array.isArray(casesData) ? casesData : []);
    return Array.isArray(list) ? list : [];
  }, [casesData]);

  const handleGenerate = () => {
    if (selectedReport === 'evidence' && selectedEvidence) {
      generateMutation.mutate({ type: 'evidence', id: selectedEvidence, format: selectedFormat });
    } else if (selectedReport === 'case' && selectedCase) {
      generateMutation.mutate({ type: 'case', id: selectedCase, format: selectedFormat });
    } else if (selectedReport === 'audit') {
      generateMutation.mutate({ type: 'audit', id: null, format: selectedFormat });
    }
  };

  const isLoading = evLoading || casesLoading;

  return (
    <div className="page-container space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-[-0.02em]">Reports</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Generate forensic reports, case summaries, and audit exports
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Evidence Items', value: evidence.length, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Active Cases', value: cases.length, icon: FolderOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Report Templates', value: reportTypes.length, icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25, ease: macEase }}>
            <Card className="stat-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', s.bg)}>
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[18px] font-extrabold tracking-tight leading-none">
                      {isLoading ? '—' : s.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Report Type Selection */}
      <div>
        <h2 className="text-[13px] font-bold mb-3">Select Report Type</h2>
        <div className="grid gap-2">
          {reportTypes.map((rt) => (
            <button
              key={rt.id}
              onClick={() => {
                setSelectedReport(rt.id as 'evidence'|'case'|'audit');
                setSelectedFormat('pdf');
              }}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left',
                selectedReport === rt.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/20 hover:bg-muted/40 border-border/30'
              )}
            >
              <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', rt.bg)}>
                <rt.icon className={cn('h-4.5 w-4.5', rt.color)} strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[13px] font-bold',
                  selectedReport === rt.id ? 'text-primary' : 'text-foreground'
                )}>{rt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{rt.desc}</p>
              </div>
              {selectedReport === rt.id && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <Card className="mac-card">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-[14px] font-bold">Configuration</h3>

          {selectedReport === 'evidence' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select Evidence</Label>
              <Select value={selectedEvidence} onValueChange={setSelectedEvidence}>
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder="Choose evidence to generate report…" />
                </SelectTrigger>
                <SelectContent>
                  {evidence.length === 0 ? (
                    <SelectItem value="_none" disabled>No evidence available</SelectItem>
                  ) : (
                    evidence.map((e: any) => (
                      <SelectItem key={e.evidence_id || e._id} value={e.evidence_id || e._id}>
                        {e.original_name || e.file_name || 'Unknown'} — {(e.evidence_id || '').slice(0, 8)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <div className="pt-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Export Format</Label>
                <Select value={selectedFormat} onValueChange={(val: 'pdf' | 'json') => setSelectedFormat(val)}>
                  <SelectTrigger className="h-9 text-[12px]">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">Court-Ready PDF Document</SelectItem>
                    <SelectItem value="json">Raw JSON Export Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedReport === 'case' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select Case</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder="Choose case to generate report…" />
                </SelectTrigger>
                <SelectContent>
                  {cases.length === 0 ? (
                    <SelectItem value="_none" disabled>No cases available</SelectItem>
                  ) : (
                    cases.map((c: any) => (
                      <SelectItem key={c.case_id || c._id} value={c.case_id || c._id}>
                        {c.case_name || 'Unknown'} — {(c.case_id || '').slice(0, 8)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <div className="pt-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Export Format</Label>
                <Select value={selectedFormat} onValueChange={(val: 'pdf' | 'json') => setSelectedFormat(val)}>
                  <SelectTrigger className="h-9 text-[12px]">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">Case Brief PDF Document</SelectItem>
                    <SelectItem value="json">Raw JSON Export Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30 text-[11px] text-muted-foreground">
                Case summary reports will include all linked evidence, team members, and activity timeline.
              </div>
            </div>
          )}

          {selectedReport === 'audit' && (
            <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-[12px] text-muted-foreground">
              Audit trail reports export all system events with timestamps, actors, and endpoints.
              The report will be generated as a PDF document.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border/30">
            <Button size="sm" className="h-9 text-[12px]" onClick={handleGenerate}
              disabled={
                generateMutation.isPending ||
                (selectedReport === 'evidence' && !selectedEvidence) ||
                (selectedReport === 'case' && !selectedCase)
              }>
              {generateMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <Download className="h-3.5 w-3.5 mr-1.5" />}
              Generate & Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <div className="text-center text-[11px] text-muted-foreground pt-2">
        Reports can be generated as court-ready PDF documents or JSON data packages and are downloaded automatically.
      </div>
    </div>
  );
};

export default ReportsPage;
