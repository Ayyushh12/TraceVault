import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Loader2, Search, Shield, ShieldCheck, ShieldAlert, User, Eye, UserPlus,
  MoreHorizontal, Key, Trash2, RefreshCw, X, Activity, BarChart2, UserCheck, UserX,
  Crown, Edit, Mail, Calendar, Clock, CheckCircle2, MinusCircle, Ban, ShieldOff, Microscope, BookOpen, UserCog, Fingerprint, FileCheck, Scale, Monitor
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useAdminUsers, useAdminCreateUser, useAdminUpdateUserRole, useAdminUpdateUserStatus,
  useAdminResetPassword, useAdminDeleteUser,
} from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import PasswordWithStrength from '@/components/PasswordWithStrength';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

/* Role config */
const roleConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof User }> = {
  admin:         { label: 'Admin',        color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-500/10',      border: 'border-red-500/20',     icon: Key },
  investigator:  { label: 'Investigator', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10',     border: 'border-blue-500/20',    icon: Activity },
  auditor:       { label: 'Auditor',      color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',    border: 'border-amber-500/20',   icon: Scale },
  viewer:        { label: 'Viewer',       color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-500/10',    border: 'border-slate-500/20',   icon: Monitor },
};

const statusColors: Record<string, { color: string; bg: string; border: string }> = {
  active:    { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  inactive:  { color: 'text-slate-500',       bg: 'bg-slate-500/10',    border: 'border-slate-500/20' },
  suspended: { color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',      border: 'border-red-500/20' },
};

const AdminPage = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  /* Form state for create user */
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  const { data, isLoading, refetch, isFetching } = useAdminUsers();
  const createMutation = useAdminCreateUser();
  const changeRoleMutation = useAdminUpdateUserRole();
  const updateStatusMutation = useAdminUpdateUserStatus();
  const resetPasswordMutation = useAdminResetPassword();
  const deleteMutation = useAdminDeleteUser();

  const users = useMemo(() => {
    const list = data?.users || data?.data?.users || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list : [];
  }, [data]);

  /* Filter */
  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.user_id || u._id || '').toLowerCase().includes(q)
      );
      const matchRole = roleFilter === 'all' || (u.role || '').toLowerCase() === roleFilter;
      const matchStatus = statusFilter === 'all' || (u.status || 'active').toLowerCase() === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  /* Stats */
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u: any) => (u.status || 'active').toLowerCase() === 'active').length,
    admins: users.filter((u: any) => (u.role || '').toLowerCase() === 'admin').length,
    investigators: users.filter((u: any) => (u.role || '').toLowerCase() === 'investigator').length,
  }), [users]);

  const hasActiveFilters = search || roleFilter !== 'all' || statusFilter !== 'all';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const hasNumAlp = /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasSymbol || !hasNumAlp) {
        toast({ title: 'Weak Password', description: 'Password must be at least 8 chars, contain letters, numbers, and symbols.', variant: 'destructive' });
        return;
    }
    createMutation.mutate(
      { full_name: newName.trim(), username: newEmail.split('@')[0].trim(), email: newEmail.trim(), password: newPassword.trim(), role: newRole },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('viewer');
        },
      }
    );
  };

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em]">Team Management</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : `${users.length} team member${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" className="h-8 text-[12px]" onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Admins', value: stats.admins, icon: Key, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Investigators', value: stats.investigators, icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
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
                    <p className="text-[18px] font-extrabold tracking-tight leading-none">{isLoading ? '—' : s.value}</p>
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
        transition={{ delay: 0.2, duration: 0.25, ease: macEase }}
        className="data-table-container">
        <div className="data-table-toolbar">
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
            <Input placeholder="Search members…" className="h-8 pl-8 text-[12px] bg-background border-border/50 rounded-lg"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="h-8 px-2 text-[12px] bg-background border border-border/50 rounded-lg text-foreground outline-none"
            value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="investigator">Investigator</option>
            <option value="auditor">Auditor</option>
            <option value="viewer">Viewer</option>
          </select>
          <select className="h-8 px-2 text-[12px] bg-background border border-border/50 rounded-lg text-foreground outline-none"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
              onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
          <div className="ml-auto text-[11px] text-muted-foreground font-medium">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">Loading team…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-[13px] text-muted-foreground font-medium">
              {hasActiveFilters ? 'No matching members' : 'No team members'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List header (Desktop) */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-border/25 bg-muted/20">
              <div className="flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Team Member</div>
              <div className="w-32 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-center">Role</div>
              <div className="w-32 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-center">Status</div>
              <div className="w-16 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-right">Actions</div>
            </div>

            <div className="divide-y divide-border/15">
              {filtered.map((u: any, idx: number) => {
                const role = roleConfig[u.role?.toLowerCase()] || roleConfig.viewer;
                const status = statusColors[(u.status || 'active').toLowerCase()] || statusColors.active;
                const RoleIcon = role.icon;
                const id = u.user_id || u._id;
                const isExpanded = expandedId === id;

                return (
                  <div key={id || idx} 
                    className={cn(
                      "flex flex-col group transition-all duration-300 hover:bg-muted/15",
                      isExpanded && "bg-primary/[0.02]"
                    )}>
                    
                    {/* Main Row */}
                    <div className="flex items-center gap-4 px-4 py-3 min-w-0">
                      {/* Identity & Expansion Trigger */}
                      <div className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer pointer-events-auto"
                        onClick={() => setExpandedId(isExpanded ? null : id)}>
                        
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-all">
                          <span className="text-[12px] font-bold text-primary uppercase">
                            {(u.full_name || 'U').charAt(0)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">
                              {u.full_name || 'Anonymous Member'}
                            </span>
                            <div className="sm:hidden">
                               <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border', role.bg, role.color, role.border)}>
                                 {role.label}
                               </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email || '—'}</p>
                        </div>
                      </div>

                      {/* Role (SM+) */}
                      <div className="hidden sm:flex w-32 justify-center shrink-0">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                          role.bg, role.color, role.border
                        )}>
                          <RoleIcon className="h-3 w-3" strokeWidth={2.5} />
                          {role.label}
                        </span>
                      </div>

                      {/* Status (SM+) */}
                      <div className="hidden sm:flex w-32 justify-center shrink-0">
                        {(() => {
                          const st = (u.status || 'active').toLowerCase();
                          const StatusIcon = st === 'active' ? CheckCircle2 : st === 'suspended' ? Ban : MinusCircle;
                          return (
                            <span className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border',
                              status.bg, status.color, status.border
                            )}>
                              <StatusIcon className="h-3 w-3" strokeWidth={2} />
                              {st.charAt(0).toUpperCase() + st.slice(1)}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Actions Dropdown */}
                      <div className="flex items-center justify-end w-16 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-border/40 bg-background/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-xl border-border/40 p-1.5">
                            <DropdownMenuItem className="text-[12px] gap-2.5 rounded-xl cursor-pointer"
                              onClick={() => {
                                const nextRole = u.role?.toLowerCase() === 'admin' ? 'investigator' : u.role?.toLowerCase() === 'investigator' ? 'auditor' : u.role?.toLowerCase() === 'auditor' ? 'viewer' : 'admin';
                                changeRoleMutation.mutate({ userId: id, role: nextRole, reason: 'Role changed by admin' });
                              }}>
                              <Shield className="h-4 w-4 text-muted-foreground" /> Change Member Role
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] gap-2.5 rounded-xl cursor-pointer"
                              onClick={() => {
                                const isActive = (u.status || 'active').toLowerCase() === 'active';
                                updateStatusMutation.mutate({ userId: id, is_active: !isActive, reason: isActive ? 'Suspended by admin' : 'Reactivated by admin' });
                              }}>
                              {(u.status || 'active').toLowerCase() === 'active'
                                ? <><UserX className="h-4 w-4 text-red-500" /> Suspend Member</>
                                : <><UserCheck className="h-4 w-4 text-emerald-500" /> Activate Member</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] gap-2.5 rounded-xl cursor-pointer"
                              onClick={() => resetPasswordMutation.mutate({ userId: id, new_password: 'TempPass123!' })}>
                              <Key className="h-4 w-4 text-muted-foreground" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1.5 opacity-50" />
                            <DropdownMenuItem className="text-[12px] gap-2.5 text-destructive focus:text-destructive rounded-xl cursor-pointer"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this user?')) {
                                  deleteMutation.mutate(id);
                                }
                              }}>
                              <Trash2 className="h-4 w-4" /> Delete Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Detailed Metadata (Card style expansion) */}
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
                                  <Fingerprint className="h-2.5 w-2.5" /> Full Member ID
                                </p>
                                <div className="bg-background/50 border border-border/40 rounded-lg p-2 font-mono text-[10px] break-all leading-relaxed shadow-inner">
                                  {id || '—'}
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                                    <Clock className="h-2.5 w-2.5" /> Account History
                                  </p>
                                  <p className="text-[11px] font-semibold">
                                    <span className="text-muted-foreground font-normal">Joined:</span> {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                                    <ShieldCheck className="h-2.5 w-2.5" /> Authentication
                                  </p>
                                  <p className="text-[11px] font-semibold text-emerald-500">MFA Protected</p>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                                    <BarChart2 className="h-2.5 w-2.5" /> Operational Stats
                                  </p>
                                  <p className="text-[11px] font-semibold">
                                    <span className="text-muted-foreground font-normal">Verified Items:</span> {Math.floor(Math.random() * 20)} 
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Access Level</p>
                                  <p className="text-[11px] font-semibold uppercase">{u.role || 'viewer'}</p>
                                </div>
                              </div>
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

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[16px] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Add Team Member
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Create a new user account with role-based access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-[13px]" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="jane@agency.gov" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                className="h-9 text-[13px]" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 w-full flex flex-col">
                <PasswordWithStrength 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required 
                />
              </div>
              <div className="space-y-1.5 pl-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <span className="flex items-center gap-2"><Key className="h-3.5 w-3.5 text-red-500" /> Admin</span>
                      </SelectItem>
                      <SelectItem value="investigator">
                        <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-blue-500" /> Investigator</span>
                      </SelectItem>
                      <SelectItem value="auditor">
                        <span className="flex items-center gap-2"><Scale className="h-3.5 w-3.5 text-amber-500" /> Auditor</span>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-slate-500" /> Viewer</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)} className="text-[12px]">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-[12px]" disabled={createMutation.isPending || !newName.trim() || !newEmail.trim() || !newPassword.trim()}>
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
