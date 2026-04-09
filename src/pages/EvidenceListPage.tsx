import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import IntegrityStatusBadge from '@/components/IntegrityStatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, ShieldCheck, Download, Search, Loader2, Upload, FileSearch, RefreshCw, X,
  Filter, BarChart2, CheckSquare, Square, Trash2, Archive, Lock, AlertTriangle
} from 'lucide-react';
import { useEvidenceList, useVerifyEvidence, useDownloadEvidence, useBulkEvidenceAction } from '@/hooks/use-api';
import { cn } from '@/lib/utils';


const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const EvidenceListPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch } = useEvidenceList();
  const verifyMutation = useVerifyEvidence();
  const downloadMutation = useDownloadEvidence();
  const bulkMutation = useBulkEvidenceAction();

  const items = useMemo(() => {
    const evidenceList = data?.evidences || data?.data?.evidences || (Array.isArray(data) ? data : []);
    return Array.isArray(evidenceList) ? evidenceList : [];
  }, [data]);

  const filtered = useMemo(() => {
    return items.filter((e: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (
        (e.original_name || e.file_name || '').toLowerCase().includes(q) ||
        (e.evidence_id || '').toLowerCase().includes(q) ||
        (e.uploaded_by_name || '').toLowerCase().includes(q)
      );
      const matchStatus = statusFilter === 'all' || (e.integrity_status || 'pending') === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    verified: items.filter((e: any) => e.integrity_status === 'verified').length,
    pending: items.filter((e: any) => e.integrity_status !== 'verified' && e.integrity_status !== 'tampered').length,
    tampered: items.filter((e: any) => e.integrity_status === 'tampered').length,
  }), [items]);

  const hasActiveFilters = search || statusFilter !== 'all';

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e: any) => e.evidence_id)));
    }
  };

  const handleBulkAction = (action: 'delete' | 'archive' | 'lock') => {
    if (selected.size === 0) return;
    bulkMutation.mutate({ action, ids: Array.from(selected) }, {
      onSuccess: () => setSelected(new Set()),
    });
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'verified') return 'Verified';
    if (status === 'tampered') return 'Tampered';
    return 'Pending';
  };

  return (
    <div className="page-container space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em]">Evidence Manager</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : `${items.length} items catalogued`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" className="h-8 text-[12px] shrink-0" onClick={() => navigate('/upload')}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Evidence
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', value: stats.total, icon: FileSearch, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Verified', value: stats.verified, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pending', value: stats.pending, icon: BarChart2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Tampered', value: stats.tampered, icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-500/10' },
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

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25, ease: macEase }}
        className="data-table-container">
        {/* Toolbar */}
        <div className="data-table-toolbar">
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
            <Input placeholder="Search evidence…" className="h-8 pl-8 text-[12px] bg-background border-border/50 rounded-lg"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="h-8 px-2 text-[12px] bg-background border border-border/50 rounded-lg text-foreground outline-none"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="tampered">Tampered</option>
          </select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
              onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
          <div className="ml-auto text-[11px] text-muted-foreground font-medium">{filtered.length} items</div>
        </div>

        {/* Bulk Action Toolbar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-primary/10 flex-wrap"
            >
              <span className="text-[12px] font-semibold text-primary">{selected.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                onClick={() => handleBulkAction('archive')} disabled={bulkMutation.isPending}>
                <Archive className="h-3 w-3" /> Archive
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                onClick={() => handleBulkAction('lock')} disabled={bulkMutation.isPending}>
                <Lock className="h-3 w-3" /> Lock 24h
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-[11px] gap-1"
                onClick={() => handleBulkAction('delete')} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] ml-auto"
                onClick={() => setSelected(new Set())}>
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-[13px] text-muted-foreground">Loading evidence…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileSearch className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-[13px] text-muted-foreground font-medium">
              {hasActiveFilters ? 'No matching evidence' : 'No evidence found'}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              {hasActiveFilters ? 'Try adjusting your search' : 'Upload your first piece of evidence to get started'}
            </p>
            {!hasActiveFilters && (
              <Button size="sm" className="mt-4 h-8 text-[12px]" onClick={() => navigate('/upload')}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Evidence
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List header (Desktop) */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-border/25 bg-muted/20">
              <div className="w-8 flex justify-center">
                <button onClick={selectAll} className="flex items-center justify-center">
                  {selected.size === filtered.length && filtered.length > 0
                    ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              <div className="flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Evidence Details</div>
              <div className="hidden md:block w-32 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-center">Status</div>
              <div className="w-24 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-right">Actions</div>
            </div>

            <div className="divide-y divide-border/15">
              {filtered.map((e: any, idx: number) => {
                const isSelected = selected.has(e.evidence_id || e._id);
                const isExpanded = expandedId === (e.evidence_id || e._id);
                const id = e.evidence_id || e._id;
                
                return (
                  <div key={id} 
                    className={cn(
                      "flex flex-col group transition-all duration-300 hover:bg-muted/15",
                      isSelected && "bg-primary/[0.03]"
                    )}>
                    
                    {/* Main Row */}
                    <div className="flex items-center gap-4 px-4 py-3 min-w-0">
                      {/* Select Toggle */}
                      <div className="w-8 shrink-0 flex justify-center">
                        <button onClick={(ev) => { ev.stopPropagation(); toggleSelect(id); }} className="flex items-center justify-center p-1">
                          {isSelected 
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-opacity" />}
                        </button>
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 flex items-center gap-3 min-w-0 pointer-events-auto cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : id)}>
                        
                        <div className={cn("flex items-center justify-center h-9 w-9 rounded-xl shrink-0 transition-all", 
                          isSelected ? "bg-primary/15" : "bg-muted/40 group-hover:bg-muted")}>
                          <FileSearch className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                             <p className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">
                                {e.original_name || e.file_name || 'Untitled Evidence'}
                             </p>
                             <div className="md:hidden">
                               <IntegrityStatusBadge status={getStatusLabel(e.integrity_status)} />
                             </div>
                          </div>
                          <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground font-medium">
                            <span className="font-mono">{(id || '').slice(0, 12)}…</span>
                            <span className="opacity-40">•</span>
                            <span>{formatSize(e.file_size)}</span>
                            {e.created_at && (
                              <>
                                <span className="opacity-40 hidden sm:inline">•</span>
                                <span className="hidden sm:inline">{new Date(e.created_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status (MD+) */}
                      <div className="hidden md:flex w-32 justify-center shrink-0">
                         <IntegrityStatusBadge status={getStatusLabel(e.integrity_status)} />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 w-24 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 hover:bg-primary/10 hover:text-primary transition-all border border-border/40"
                          onClick={(ev) => { ev.stopPropagation(); navigate(`/evidence/${id}`); }} title="View">
                          <Eye className="h-4 w-4" strokeWidth={1.8} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 hover:bg-primary/10 hover:text-primary transition-all border border-border/40"
                          onClick={(ev) => { ev.stopPropagation(); verifyMutation.mutate(id); }}
                          disabled={verifyMutation.isPending} title="Verify">
                          <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content (Vertical Expansion) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: macEase }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 ml-12">
                            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 flex items-center gap-1.5">
                                  <Lock className="h-2.5 w-2.5" /> Secure Hash (SHA-256)
                                </p>
                                <div className="bg-background/50 border border-border/40 rounded-lg p-2 font-mono text-[10px] break-all leading-relaxed shadow-inner">
                                  {e.file_hash || '—'}
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">MIME Type</p>
                                  <p className="text-[11px] font-semibold">{e.mime_type || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Upload Method</p>
                                  <p className="text-[11px] font-semibold text-primary">{e.encryption_algorithm || 'AES-256-GCM'} Security</p>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Uploader</p>
                                  <p className="text-[11px] font-semibold">{e.uploaded_by_name || 'System'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Full System ID</p>
                                  <p className="text-[10px] font-mono opacity-60 truncate">{id}</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                               <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg"
                                 title={e.is_locked ? "Download Blocked — Legal Hold Active" : "Full Download"}
                                 onClick={(ev) => { ev.stopPropagation(); downloadMutation.mutate({ evidence_id: id, original_name: e.original_name }); }}
                                 disabled={downloadMutation.isPending || e.is_locked}>
                                 <Download className="h-3 w-3 mr-1.5" /> Full Download
                               </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default EvidenceListPage;
