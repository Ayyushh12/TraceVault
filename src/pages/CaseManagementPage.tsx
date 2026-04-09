import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Loader2, Search, Filter, X, ChevronRight, Calendar, User,
  Clock, FileText, AlertTriangle, ShieldCheck, Users, Eye, MoreHorizontal,
  BarChart2, Activity, Tag, FolderPlus, RefreshCw, Edit, Trash2, Archive,
  MessageSquare, ChevronDown, Send, HardDrive, ExternalLink
} from 'lucide-react';
import { 
  useCases, useCreateCase, useUpdateCase, useDeleteCase, useAddCaseNote, 
  useDownloadReport, useExportCase, useEvidenceList, useUsers 
} from '@/hooks/use-api';
import { cn } from '@/lib/utils';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Activity }> = {
  open:          { label: 'Open',       color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20', icon: FolderOpen },
  active:        { label: 'Active',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Activity },
  investigating: { label: 'Investigating', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: FileText },
  in_progress:   { label: 'In Progress', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Activity },
  closed:        { label: 'Closed',     color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: ShieldCheck },
  archived:      { label: 'Archived',   color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', icon: Archive },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical',   color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  high:     { label: 'High',       color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  medium:   { label: 'Medium',     color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  low:      { label: 'Low',        color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
};

const classificationConfig: Record<string, { label: string; color: string }> = {
  confidential:  { label: 'Confidential',  color: 'text-red-500' },
  restricted:    { label: 'Restricted',    color: 'text-amber-500' },
  official:      { label: 'Official',      color: 'text-blue-500' },
  unclassified:  { label: 'Unclassified',  color: 'text-muted-foreground' },
  secret:        { label: 'Secret',        color: 'text-red-600' },
  top_secret:    { label: 'Top Secret',    color: 'text-red-700' },
};

const getDefaultConfig = (key: string, map: Record<string, any>) => {
  return map[key?.toLowerCase()] || map[Object.keys(map)[0]];
};

const formatAge = (dateStr: string) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
};

// ─── Sub-components for Real Logic ────────────────────────────

const CaseArtifactsRegistry = ({ caseId }: { caseId: string }) => {
  const { data, isLoading } = useEvidenceList({ case_id: caseId, limit: 50 });
  const artifacts = data?.evidence || data || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest">Synchronizing Registry…</span>
      </div>
    );
  }

  if (!artifacts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-50 bg-muted/5 rounded-xl border border-dashed border-border/40 m-5">
        <HardDrive className="h-8 w-8 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-[13px] font-bold text-muted-foreground/80">Zero Artifacts Linked</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1 max-w-[240px]">This investigation container currently holds no linked forensic assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-table">
      <table className="w-full text-left border-collapse">
        <thead className="bg-muted/30 sticky top-0 z-10 border-b border-border/30">
          <tr>
            <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Artifact Name</th>
            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hash (SHA-256)</th>
            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {artifacts.map((a: any) => (
            <tr key={a.evidence_id || a._id} className="hover:bg-muted/20 transition-colors group">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                    <FileText className="h-3.5 w-3.5 text-primary/70" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold leading-tight truncate max-w-[180px]">{a.filename}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{(a.evidence_id || a._id).slice(0, 12)}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight bg-background/50">
                  {a.file_type || 'DATA'}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <span className="text-[11px] font-mono text-muted-foreground/60 block truncate max-w-[140px]">
                  {a.sha256_hash || '—'}
                </span>
              </td>
              <td className="px-4 py-4 text-right">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {formatAge(a.created_at)}
                </span>
                <button className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary">
                  <ExternalLink className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CaseTeamManagement = ({ investigatorIds }: { investigatorIds: string[] }) => {
  const { data: users, isLoading } = useUsers();
  
  const team = useMemo(() => {
    if (!users || !investigatorIds) return [];
    const list = users.users || users || [];
    return investigatorIds.map(id => {
      const u = list.find((user: any) => user.user_id === id || user._id === id);
      return u || { user_id: id, full_name: 'Unknown Agent', role: 'Auditor' };
    });
  }, [users, investigatorIds]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-10 w-full skeleton rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {team.map((m: any, i: number) => (
        <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/20 transition-colors border border-transparent hover:border-border/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
              {m.full_name?.charAt(0) || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold truncate tracking-tight">{m.full_name}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{m.role || 'Investigator'}</p>
            </div>
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
        </div>
      ))}
    </div>
  );
};

const CaseManagementPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');

  const { data, isLoading, refetch, isFetching } = useCases({ limit: 100 });
  const createMutation = useCreateCase();
  const updateMutation = useUpdateCase();
  const deleteMutation = useDeleteCase();
  const addNoteMutation = useAddCaseNote();
  const downloadReportMutation = useDownloadReport();
  const exportCaseMutation = useExportCase();

  /* Form state */
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState('open');
  const [formPriority, setFormPriority] = useState('medium');
  const [formClassification, setFormClassification] = useState('unclassified');
  const [formType, setFormType] = useState('investigation');

  const cases = useMemo(() => {
    const list = data?.cases || data?.data?.cases || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list : [];
  }, [data]);

  const filtered = useMemo(() => {
    return cases.filter((c: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (
        (c.case_name || c.title || '').toLowerCase().includes(q) ||
        (c.case_id || c._id || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
      const matchStatus = statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter;
      const matchPriority = priorityFilter === 'all' || (c.priority || '').toLowerCase() === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [cases, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: cases.length,
    open: cases.filter((c: any) => ['open', 'active'].includes((c.status || '').toLowerCase())).length,
    investigating: cases.filter((c: any) => ['investigating', 'in_progress'].includes((c.status || '').toLowerCase())).length,
    closed: cases.filter((c: any) => (c.status || '').toLowerCase() === 'closed').length,
  }), [cases]);

  const hasActiveFilters = search || statusFilter !== 'all' || priorityFilter !== 'all';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    createMutation.mutate(
      {
        case_name: formTitle.trim(),
        title: formTitle.trim(),
        description: formDesc.trim(),
        status: formStatus,
        priority: formPriority,
        classification: formClassification,
        case_type: formType,
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          resetForm();
        },
      }
    );
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    updateMutation.mutate(
      {
        id: selectedCase.case_id || selectedCase._id,
        data: {
          case_name: formTitle.trim() || undefined,
          description: formDesc.trim(),
          status: formStatus,
          priority: formPriority,
          classification: formClassification,
        },
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          // Update selected case in UI
          setSelectedCase({ ...selectedCase, ...{
            case_name: formTitle.trim() || selectedCase.case_name,
            description: formDesc.trim(),
            status: formStatus,
            priority: formPriority,
            classification: formClassification,
          }});
          resetForm();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedCase) return;
    deleteMutation.mutate(selectedCase.case_id || selectedCase._id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        setViewMode('list');
        setSelectedCase(null);
      },
    });
  };

  const handleAddNote = () => {
    if (!selectedCase || !noteContent.trim()) return;
    addNoteMutation.mutate(
      { id: selectedCase.case_id || selectedCase._id, content: noteContent.trim() },
      {
        onSuccess: (updatedData) => {
          setNoteContent('');
          // Refresh data
          refetch().then((newData) => {
            const list = newData.data?.cases || newData.data?.data?.cases || [];
            const found = list.find((c: any) => (c.case_id || c._id) === (selectedCase.case_id || selectedCase._id));
            if (found) setSelectedCase(found);
          });
        },
      }
    );
  };

  const openEdit = (c: any) => {
    setSelectedCase(c);
    setFormTitle(c.case_name || c.title || '');
    setFormDesc(c.description || '');
    setFormStatus(c.status || 'open');
    setFormPriority(c.priority || 'medium');
    setFormClassification(c.classification || 'unclassified');
    setFormType(c.case_type || 'investigation');
    setShowEditDialog(true);
  };

  const openDetail = (c: any) => {
    setSelectedCase(c);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormStatus('open');
    setFormPriority('medium');
    setFormClassification('unclassified');
    setFormType('investigation');
  };

  const currentStatus = selectedCase ? getDefaultConfig(selectedCase.status, statusConfig) : null;
  const currentPriority = selectedCase ? getDefaultConfig(selectedCase.priority, priorityConfig) : null;
  const currentClassification = selectedCase ? getDefaultConfig(selectedCase.classification, classificationConfig) : null;

  return (
    <div className="page-container min-h-full">
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: macEase }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-[-0.02em]">Case Management</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {isLoading ? 'Loading…' : `${cases.length} case${cases.length !== 1 ? 's' : ''} • ${stats.open} active`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" className="h-8 text-[12px] bg-primary hover:bg-primary/90 rounded-lg" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Case
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Cases', value: stats.total, icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Active', value: stats.open, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Investigating', value: stats.investigating, icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Closed', value: stats.closed, icon: ShieldCheck, color: 'text-slate-500', bg: 'bg-slate-500/10' },
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
                          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">{s.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                <Input placeholder="Search cases…" className="h-8 pl-8 text-[12px] bg-muted/40 border-transparent rounded-lg"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar no-scrollbar">
                <select className="h-8 px-2 text-[12px] bg-muted/40 border border-transparent rounded-lg text-foreground outline-none cursor-pointer hover:bg-muted/60 transition-colors"
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                  <option value="investigating">Investigating</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
                <select className="h-8 px-2 text-[12px] bg-muted/40 border border-transparent rounded-lg text-foreground outline-none cursor-pointer hover:bg-muted/60 transition-colors"
                  value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="all">All Priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground hover:bg-muted"
                  onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}

              <div className="ml-auto text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{filtered.length} Case{filtered.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Case Grid */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-[13px] text-muted-foreground font-medium">Retrieving forensic records…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                <div className="bg-muted/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border border-border/30">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="text-[14px] text-foreground font-bold">
                  {hasActiveFilters ? 'No matching investigation cases' : 'Registry is empty'}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px] mx-auto">
                  {hasActiveFilters ? 'Adjust filters to locate specific records' : 'Initiate a new investigation to start logging evidence and tracking progress.'}
                </p>
                {!hasActiveFilters && (
                  <Button size="sm" className="mt-5 h-8 text-[12px] rounded-lg" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Start New Case
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c: any, i: number) => {
                  const status = getDefaultConfig(c.status, statusConfig);
                  const priority = getDefaultConfig(c.priority, priorityConfig);
                  const StatusIcon = status.icon;

                  return (
                    <motion.div key={c.case_id || c._id || i}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25, ease: macEase }}
                    >
                      <Card className="mac-card group cursor-pointer border-border/40 hover:border-primary/30 transition-all duration-300 h-full overflow-hidden flex flex-col"
                        onClick={() => openDetail(c)}>
                        {/* Status Strip */}
                        <div className={cn('h-1 w-full', status.color.replace('text-', 'bg-'))} />
                        
                        <CardContent className="p-4 flex flex-col flex-1">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider',
                              status.bg, status.color, status.border)}>
                              <StatusIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                              {status.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider',
                                priority.bg, priority.color, priority.border)}>
                                {priority.label}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-[14px] font-bold tracking-tight line-clamp-1 group-hover:text-primary transition-colors leading-tight mb-1.5">
                            {c.case_name || c.title || 'Untitled Investigation'}
                          </h3>
                          <p className="text-[12px] text-muted-foreground line-clamp-2 flex-1 leading-relaxed mb-4">
                            {c.description || 'No case brief available for this investigation.'}
                          </p>

                          <div className="mt-auto space-y-2.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-3 text-muted-foreground/70 font-medium">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" strokeWidth={1.8} />
                                  {formatAge(c.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" strokeWidth={1.8} />
                                  {c.evidence_count || 0}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-muted-foreground/40 bg-muted/30 px-1.5 py-0.5 rounded">
                                {(c.case_id || c._id || '').slice(0, 8)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between items-end pt-2 border-t border-border/10">
                              <div className="flex -space-x-1.5">
                                {[1, 2].map(j => (
                                  <div key={j} className="h-5 w-5 rounded-full border border-background bg-muted flex items-center justify-center">
                                    <User className="h-2.5 w-2.5 text-muted-foreground/70" />
                                  </div>
                                ))}
                                <div className="h-5 w-5 rounded-full border border-background bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                  +1
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all rounded-md"
                                  onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                                  <Edit className="h-3 w-3 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all rounded-md text-destructive hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); setSelectedCase(c); setShowDeleteDialog(true); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          /* ========= CASE CONSOLE VIEW ========= */
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: macEase }}
            className="flex flex-col h-full space-y-6"
          >
            {/* Console Header */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60 font-medium">
                <button onClick={() => setViewMode('list')} className="hover:text-primary flex items-center gap-1 transition-colors">
                  Case Management
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground/80 truncate font-semibold">
                  {selectedCase?.case_name || selectedCase?.title || 'Case Console'}
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/40 mac-shadow-rest">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <FolderOpen className="h-6 w-6 text-primary" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-xl font-bold tracking-tight">{selectedCase?.case_name || selectedCase?.title}</h2>
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                        currentStatus?.bg, currentStatus?.color, currentStatus?.border)}>
                        {currentStatus?.label}
                      </span>
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                        currentPriority?.bg, currentPriority?.color, currentPriority?.border)}>
                        {currentPriority?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 font-mono">
                      <span className="flex items-center gap-1">CASE-ID: {(selectedCase?.case_id || selectedCase?._id)?.toUpperCase()}</span>
                      <span className="h-3 w-px bg-border/40" />
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Created: {selectedCase?.created_at ? new Date(selectedCase.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl text-[12px] font-semibold gap-2"
                    onClick={() => downloadReportMutation.mutate({ id: selectedCase.case_id || selectedCase._id, name: selectedCase.case_name || 'case' })}
                    disabled={downloadReportMutation.isPending}>
                    {downloadReportMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-4 w-4 text-primary" />}
                    PDF Report
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl text-[12px] font-semibold gap-2"
                    onClick={() => exportCaseMutation.mutate({ id: selectedCase.case_id || selectedCase._id, name: selectedCase.case_name || 'case' })}
                    disabled={exportCaseMutation.isPending}>
                    {exportCaseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-4 w-4 text-primary" />}
                    Export Case
                  </Button>
                  <div className="h-6 w-px bg-border/40 mx-1" />
                  <Button variant="secondary" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => openEdit(selectedCase)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteDialog(true)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden no-horizontal-scroll">
              {/* Main Content Area */}
              <div className="lg:col-span-8 flex flex-col gap-6 scrollable-content overflow-y-auto pr-1">
                {/* Description Card */}
                <Card className="rounded-2xl border-border/40 overflow-hidden">
                  <div className="bg-muted/30 px-5 py-3 border-b border-border/30">
                    <h3 className="text-[13px] font-bold flex items-center gap-2 text-foreground/80">
                      <FileText className="h-4 w-4 text-primary/70" /> Investigation Brief
                    </h3>
                  </div>
                  <CardContent className="p-5">
                    <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {selectedCase?.description || 'No detailed investigation summary has been provided for this case.'}
                    </p>
                    {selectedCase?.case_type && (
                      <div className="mt-4 flex items-center gap-2 pt-4 border-t border-border/10">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Classification Level:</span>
                        <Badge variant="secondary" className={cn('text-[10px] font-bold uppercase tracking-tight', currentClassification?.color)}>
                          {currentClassification?.label}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Evidence Panel (Integrated Registry) */}
                <Card className="rounded-2xl border-border/40 overflow-hidden flex-1 flex flex-col min-h-[300px] no-horizontal-scroll">
                  <div className="bg-muted/30 px-5 py-3 border-b border-border/30 flex items-center justify-between shrink-0">
                    <h3 className="text-[13px] font-bold flex items-center gap-2 text-foreground/80">
                      <ShieldCheck className="h-4 w-4 text-emerald-500/70" /> Forensic Artifact Registry
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-bold bg-background/50">
                      {selectedCase?.evidence_count || 0} ITEMS TOTAL
                    </Badge>
                  </div>
                  <CardContent className="p-0 flex-1 overflow-auto bg-background/20 relative">
                    <CaseArtifactsRegistry caseId={selectedCase.case_id || selectedCase._id} />
                  </CardContent>
                  <div className="bg-muted/10 px-5 py-2 border-t border-border/10 shrink-0">
                    <p className="text-[10px] text-muted-foreground/60 font-medium italic">
                      Records are hash-chained to the central TraceVault ledger.
                    </p>
                  </div>
                </Card>
              </div>

              {/* Sidebar Area */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Notes Engine */}
                <Card className="rounded-2xl border-border/40 overflow-hidden flex flex-col max-h-[420px]">
                  <div className="bg-muted/30 px-5 py-3 border-b border-border/30 flex items-center justify-between shrink-0">
                    <h3 className="text-[13px] font-bold flex items-center gap-2 text-foreground/80">
                      <MessageSquare className="h-4 w-4 text-primary/70" /> Case Notes
                    </h3>
                  </div>
                  <CardContent className="p-4 flex flex-col flex-1 min-h-0 bg-muted/5">
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 sidebar-scroll min-h-[160px]">
                      {selectedCase?.notes?.length > 0 ? (
                        selectedCase.notes.map((note: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-card border border-border/30 mac-shadow-rest">
                            <p className="text-[12px] leading-relaxed text-foreground/90">{note.content}</p>
                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/10">
                              <span className="text-[10px] font-bold text-primary/80">{note.author_name || 'INTERNAL AGENT'}</span>
                              <span className="text-[9px] text-muted-foreground/50">{note.created_at ? formatAge(note.created_at) + ' ago' : ''}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                          <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                          <p className="text-[11px] font-medium text-muted-foreground">No coordination notes yet</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 pt-1">
                      <Input placeholder="Enter briefing note…" className="h-9 text-[12px] rounded-xl bg-background border-border/40"
                        value={noteContent} onChange={(e) => setNoteContent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()} />
                      <Button size="icon" className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90" onClick={handleAddNote}
                        disabled={!noteContent.trim() || addNoteMutation.isPending}>
                        {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Team Card (Real Management) */}
                <Card className="rounded-2xl border-border/40 overflow-hidden">
                  <div className="bg-muted/30 px-5 py-3 border-b border-border/30">
                    <h3 className="text-[13px] font-bold flex items-center gap-2 text-foreground/80">
                      <Users className="h-4 w-4 text-primary/70" /> Investigation Team
                    </h3>
                  </div>
                  <CardContent className="p-4">
                    <CaseTeamManagement investigatorIds={selectedCase?.investigators || []} />
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[11px] font-bold text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/20 mt-3"
                      onClick={() => openEdit(selectedCase)}>
                      <User className="h-3 w-3 mr-1.5" /> Modify Team
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========= CREATE CASE DIALOG ========= */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[520px] rounded-3xl border-border/40 mac-shadow-modal">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderPlus className="h-4 w-4 text-primary" />
              </div>
              Initialize New Investigation
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed pt-1">
              Establishing a new forensic case container. Once registered, evidence can be formally linked for hash-chain tracking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5 pt-3">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Investigation Title</Label>
              <Input placeholder="E.g., Op-Alpha: Server Node A Exfiltration Analysis"
                value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                className="h-10 text-[13px] rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 transition-all font-medium" maxLength={120} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Operational Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="open">Opened</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Response Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="critical">🔴 CRITICAL [L1]</SelectItem>
                    <SelectItem value="high">🟠 HIGH [L2]</SelectItem>
                    <SelectItem value="medium">🟡 MEDIUM [L3]</SelectItem>
                    <SelectItem value="low">🔵 LOW [L4]</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Data Classification</Label>
                <Select value={formClassification} onValueChange={setFormClassification}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="unclassified">Unclassified</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="secret">Secret</SelectItem>
                    <SelectItem value="top_secret">Top Secret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Incident Category</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="investigation">General Investigation</SelectItem>
                    <SelectItem value="incident_response">Incident Response</SelectItem>
                    <SelectItem value="compliance">Compliance Audit</SelectItem>
                    <SelectItem value="litigation">Legal / Litigation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Investigation Brief</Label>
              <Textarea placeholder="Define primary objectives, methodology, and observed anomalies…"
                value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                rows={3} className="text-[13px] resize-none rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 transition-all leading-relaxed" maxLength={2000} />
            </div>

            <DialogFooter className="pt-2 gap-2 pb-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)} className="text-[12px] rounded-xl h-10 px-6">
                Discard
              </Button>
              <Button type="submit" size="sm" className="text-[12px] bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 px-8 mac-shadow-rest" disabled={!formTitle.trim() || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Registry Case
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========= EDIT CASE DIALOG ========= */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[520px] rounded-3xl border-border/40 mac-shadow-modal">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Edit className="h-4 w-4 text-primary" />
              </div>
              Update Case Metadata
            </DialogTitle>
            <DialogDescription className="text-[12px] pt-1">
              Modifying the active investigation container. All changes are logged to the case audit ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEdit} className="space-y-5 pt-3">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Investigation Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                className="h-10 text-[13px] rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 transition-all font-medium" maxLength={120} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🔵 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Classification</Label>
              <Select value={formClassification} onValueChange={setFormClassification}>
                <SelectTrigger className="h-10 text-[12px] rounded-xl bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="confidential">Confidential</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="top_secret">Top Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">Investigation Brief</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                rows={3} className="text-[13px] resize-none rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 transition-all leading-relaxed" maxLength={2000} />
            </div>

            <DialogFooter className="pt-2 gap-2 pb-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditDialog(false)} className="text-[12px] rounded-xl h-10 px-6">
                Abort
              </Button>
              <Button type="submit" size="sm" className="text-[12px] font-bold rounded-xl h-10 px-8 bg-primary hover:bg-primary/90 text-white mac-shadow-rest" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                Commit Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========= DELETE / ARCHIVE CONFIRMATION ========= */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl border-border/40 mac-shadow-modal">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold flex items-center gap-2.5 text-destructive">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Archive Case Record?
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed pt-2">
              You are about to archive investigation <strong>{selectedCase?.case_name || selectedCase?.title}</strong>.
              Archiving will lock the registry and move it to history. Linked evidence will remain intact but the container will be deep-frozen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-6 gap-2">
            <Button variant="ghost" size="sm" className="text-[12px] font-bold rounded-xl h-10 px-6" onClick={() => setShowDeleteDialog(false)}>
              No, Keep Active
            </Button>
            <Button variant="destructive" size="sm" className="text-[12px] font-bold rounded-xl h-10 px-8 mac-shadow-rest" onClick={handleDelete}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Archive className="h-3.5 w-3.5 mr-2" />}
              Archive Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseManagementPage;
