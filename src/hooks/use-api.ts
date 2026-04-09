/**
 * React Query hooks for all TraceVault API endpoints.
 * All hooks call real backend via services/api.ts — zero mock data.
 *
 * REAL-TIME FEATURES:
 * - Dashboard polls every 15s for live stats
 * - Mutations immediately invalidate caches
 * - Short staleTime for critical data
 * - Optimistic updates where possible
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loginApi,
  registerApi,
  logoutApi,
  getMe,
  updateProfile,
  getDashboardStats,
  globalSearch,
  getEvidenceList,
  getEvidenceDetail,
  uploadEvidence,
  verifyEvidence,
  analyzeEvidence,
  lockEvidence,
  unlockEvidence,
  transferEvidence,
  downloadEvidence,
  bulkEvidenceAction,
  getEvidenceVersions,
  validateChain,
  getCases,
  getCaseDetail,
  getCaseStats,
  createCase,
  updateCase,
  deleteCase,
  addCaseNote,
  downloadReport,
  exportCase,
  getCustodyTimeline,
  getCustodyEvents,
  transferCustody,
  verifyChainIntegrity,
  verifyFileIntegrity,
  getAuditLogs,
  getAuditAnalytics,
  generateReport,
  getLedgerAnchors,
  getUsers,
  adminGetUsers,
  adminGetUserDetail,
  adminCreateUser,
  adminChangeUserRole,
  adminUpdateUserStatus,
  adminForcePasswordReset,
  adminDeleteUser,
  adminBulkAction,
  adminSecurityDashboard,
  adminExportAuditLogs,
  getThreatDashboard,
  getEvidenceRisk,
  getCaseThreat,
  getAnomalies,
  getDuplicates,
  getGraphData,
  getSessionLogs,
  getSessionStats,
  getEvidenceTimelineFeed,
  getEvidenceTimelineSummary,
  getCustodyChain,
  verifyCustodyChainFull,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';

// ─── Helpers ────────────────────────────────────────────────
function unwrap(res: any) {
  return res?.data?.data ?? res?.data ?? res;
}

// ─── Auth Hooks ─────────────────────────────────────────────

export function useLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginApi(email, password),
    onSuccess: (res) => {
      const payload = unwrap(res);
      const token = payload?.token;
      const refreshToken = payload?.refresh_token;
      const user = payload?.user;

      if (!token || !user) {
        toast({ title: 'Login Error', description: 'Unexpected response format.', variant: 'destructive' });
        return;
      }

      login(user, token, refreshToken);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Invalid credentials';
      toast({ title: 'Authentication Failed', description: msg, variant: 'destructive' });
    },
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (data: {
      username: string;
      email: string;
      password: string;
      full_name: string;
      role?: string;
      department?: string;
      badge_number?: string;
    }) => registerApi(data),
    onSuccess: (res) => {
      const payload = unwrap(res);
      const token = payload?.token;
      const user = payload?.user;

      if (token && user) {
        login(user, token, payload?.refresh_token);
        toast({ title: 'Registration Successful', description: `Welcome, ${user.full_name}` });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Registration failed';
      toast({ title: 'Registration Error', description: msg, variant: 'destructive' });
    },
  });
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore();

  return useMutation({
    mutationFn: () => logoutApi(refreshToken || ''),
    onSettled: () => {
      logout();
    },
  });
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => unwrap(r)),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (data: Record<string, any>) => updateProfile(data).then((r) => unwrap(r)),
    onSuccess: (data: any) => {
      if (user && data) {
        setUser({ ...user, full_name: data.full_name || user.full_name });
      }
      toast({ title: 'Profile Updated', description: 'Your display name has been changed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Dashboard Hooks ────────────────────────────────────────

export function useDashboardStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => getDashboardStats().then((r) => unwrap(r)),
    enabled: isAuthenticated,
    staleTime: 10 * 1000,       // Consider data stale after 10s
    refetchInterval: 15 * 1000, // Poll every 15s for live feel
  });
}

export function useGlobalSearch(query: string, type?: string) {
  return useQuery({
    queryKey: ['search', query, type],
    queryFn: () => globalSearch({ q: query, type }).then((r) => unwrap(r)),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}

// ─── Evidence Hooks ─────────────────────────────────────────

export function useEvidenceList(params?: { case_id?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['evidence', params],
    queryFn: () => getEvidenceList(params).then((r) => unwrap(r)),
    staleTime: 10 * 1000,  // Reduced from 30s → 10s for faster updates
  });
}

export function useEvidenceDetail(id: string) {
  return useQuery({
    queryKey: ['evidence', id],
    queryFn: () => getEvidenceDetail(id).then((r) => unwrap(r)),
    enabled: !!id,
  });
}

export function useUploadEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (p: number) => void }) => 
      uploadEvidence(formData, onProgress),
    onSuccess: () => {
      // Immediately invalidate ALL related queries for instant UI update
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast({ title: 'Evidence Uploaded', description: 'File has been hashed, encrypted, and catalogued.' });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Upload failed';
      toast({ title: 'Upload Failed', description: msg, variant: 'destructive' });
    },
  });
}

export function useVerifyEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => verifyEvidence(id).then((r) => unwrap(r)),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const ok = data?.overall_result === 'pass';
      toast({
        title: ok ? 'Integrity Verified' : 'Integrity Check Failed',
        description: ok
          ? `All ${data?.methods_run?.length || 0} verification methods passed.`
          : `Hash mismatch — possible tampering detected across ${data?.multi_hash?.mismatches?.length || 1} algorithm(s).`,
        variant: ok ? 'default' : 'destructive',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Verification Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAnalyzeEvidence(id: string) {
  return useQuery({
    queryKey: ['evidence', id, 'analyze'],
    queryFn: () => analyzeEvidence(id).then((r) => unwrap(r)),
    enabled: false, // Wait for manual trigger
  });
}

export function useLockEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, durationHours, reason }: { id: string, durationHours: number, reason: string }) =>
      lockEvidence(id, durationHours, reason).then((r) => unwrap(r)),
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['threat'] });
      toast({
        title: 'Evidence Locked',
        description: `Successfully locked for ${variables.durationHours} hours.`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Lock Failed', description: err.response?.data?.error || err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useUnlockEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) =>
      unlockEvidence(id, reason).then((r) => unwrap(r)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['threat'] });
      toast({
        title: 'Evidence Unlocked',
        description: 'Legal hold released. Asset is now fully accessible.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Unlock Failed', description: err.response?.data?.error || err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useDownloadEvidence() {
  return useMutation({
    mutationFn: async (evidence: { evidence_id: string; original_name: string }) => {
      const res = await downloadEvidence(evidence.evidence_id);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidence.original_name || 'evidence-file';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: 'Download Started', description: 'File is being saved locally.' });
    },
    onError: (err: any) => {
      toast({ title: 'Download Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Case Hooks ─────────────────────────────────────────────

export function useCases(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['cases', params],
    queryFn: () => getCases(params).then((r) => unwrap(r)),
    staleTime: 10 * 1000,  // Reduced from 30s → 10s
  });
}

export function useCaseDetail(id: string) {
  return useQuery({
    queryKey: ['cases', id],
    queryFn: () => getCaseDetail(id).then((r) => unwrap(r)),
    enabled: !!id,
  });
}

export function useCaseStats() {
  return useQuery({
    queryKey: ['cases', 'stats'],
    queryFn: () => getCaseStats().then((r) => unwrap(r)),
    staleTime: 15 * 1000,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title?: string;
      case_name?: string;
      description?: string;
      classification?: string;
      priority?: string;
      case_type?: string;
      status?: string;
    }) => createCase(data),
    onSuccess: () => {
      // Invalidate all case-related caches immediately
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast({ title: 'Case Created', description: 'New case has been opened.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to Create Case', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { case_name?: string; description?: string; status?: string; priority?: string; classification?: string } }) =>
      updateCase(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['cases', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Case Updated', description: 'Case details have been saved.' });
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Case Archived', description: 'Case has been archived.' });
    },
    onError: (err: any) => {
      toast({ title: 'Archive Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAddCaseNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      addCaseNote(id, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cases', variables.id] });
      toast({ title: 'Note Added', description: 'Case note has been recorded.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to Add Note', description: err.response?.data?.error || 'Error', variant: 'destructive' });
    },
  });
}

export function useDownloadReport() {
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => downloadReport(id, name),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Forensic report downloaded successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Download Failed', description: err.response?.data?.error || 'Error', variant: 'destructive' });
    },
  });
}



export function useExportCase() {
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => exportCase(id, name),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Offline export package downloaded successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Export Failed', description: err.response?.data?.error || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Custody Hooks ──────────────────────────────────────────

export function useCustodyTimeline(evidenceId: string) {
  return useQuery({
    queryKey: ['custody', 'timeline', evidenceId],
    queryFn: () => getCustodyTimeline(evidenceId).then((r) => unwrap(r)),
    enabled: !!evidenceId,
  });
}

export function useCustodyEvents(params?: { evidence_id?: string; page?: number }) {
  return useQuery({
    queryKey: ['custody', 'events', params],
    queryFn: () => getCustodyEvents(params).then((r) => unwrap(r)),
    staleTime: 15 * 1000,
  });
}

export function useTransferCustody() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, to_user_id, reason }: { id: string, to_user_id: string, reason: string }) =>
      transferEvidence(id, to_user_id, reason).then((r) => unwrap(r)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['custody'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ 
        title: 'Custody Transferred', 
        description: 'Legal custody has been transitioned and recorded in the immutable chain.' 
      });
    },
    onError: (err: any) => {
      toast({ title: 'Transfer Failed', description: err.response?.data?.message || err.response?.data?.error || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Verification Hooks ─────────────────────────────────────

export function useVerifyChainIntegrity() {
  return useMutation({
    mutationFn: (evidenceId: string) => verifyChainIntegrity(evidenceId).then((r) => unwrap(r)),
    onSuccess: (data: any) => {
      const ok = data?.chain_valid || data?.valid;
      toast({
        title: ok ? 'Chain Valid' : 'Chain Broken',
        description: ok ? 'Custody chain is cryptographically intact.' : data?.message || 'Chain validation failed.',
        variant: ok ? 'default' : 'destructive',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Chain Validation Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useVerifyFileIntegrity() {
  return useMutation({
    mutationFn: (evidenceId: string) => verifyFileIntegrity(evidenceId).then((r) => unwrap(r)),
    onSuccess: (data: any) => {
      const ok = data?.verified || data?.integrity_valid;
      toast({
        title: ok ? 'File Integrity Verified' : 'File Integrity Compromised',
        description: ok ? 'Computed hash matches stored hash.' : 'Hash mismatch detected.',
        variant: ok ? 'default' : 'destructive',
      });
    },
    onError: (err: any) => {
      toast({ title: 'File Verification Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Audit Hooks ────────────────────────────────────────────

export function useBulkEvidenceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ids, reason }: { action: 'delete' | 'archive' | 'lock'; ids: string[]; reason?: string }) =>
      bulkEvidenceAction(action, ids, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Bulk Action Complete', description: `${vars.action} applied to ${vars.ids.length} item(s).` });
    },
    onError: (err: any) => {
      toast({ title: 'Bulk Action Failed', description: err.response?.data?.error || 'Error', variant: 'destructive' });
    },
  });
}

export function useEvidenceVersions(id: string) {
  return useQuery({
    queryKey: ['evidence', id, 'versions'],
    queryFn: () => getEvidenceVersions(id).then((r) => unwrap(r)),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

// ─── Audit Hooks (legacy label) ────────────────────────────────

export function useAuditLogs(params?: { page?: number; limit?: number; user_id?: string }) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => getAuditLogs(params).then((r) => unwrap(r)),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useAuditAnalytics(params?: { days?: number }) {
  return useQuery({
    queryKey: ['audit', 'analytics', params],
    queryFn: () => getAuditAnalytics(params).then((r) => unwrap(r)),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ─── Report Hooks ───────────────────────────────────────────

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({ type, id, format }: { type: 'evidence'|'case'|'audit', id: string | null, format: 'json' | 'pdf' }) => generateReport(type, id, format),
    onSuccess: (res: any, variables) => {
      let blob;
      if (variables.format === 'pdf') {
        blob = new Blob([res.data], { type: 'application/pdf' });
      } else {
        blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${variables.type}-report-${Date.now()}.${variables.format}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (err: any) => {
      toast({ title: 'Report Generation Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Users Hook ─────────────────────────────────────────────

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers().then((r) => unwrap(r)),
    staleTime: 60 * 1000,
  });
}

// ─── Ledger Hook ────────────────────────────────────────────

export function useLedgerAnchors(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['ledger', params],
    queryFn: () => getLedgerAnchors(params).then((r) => unwrap(r)),
    staleTime: 60 * 1000,
  });
}

// ─── Admin Hooks ────────────────────────────────────────────

export function useAdminUsers(params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminGetUsers(params).then((r) => unwrap(r)),
    staleTime: 15 * 1000,
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminGetUserDetail(userId).then((r) => unwrap(r)),
    enabled: !!userId,
  });
}

export function useAdminSecurityDashboard() {
  return useQuery({
    queryKey: ['admin', 'security'],
    queryFn: () => adminSecurityDashboard().then((r) => unwrap(r)),
    staleTime: 30 * 1000,
  });
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      username: string;
      email: string;
      password: string;
      full_name: string;
      role?: string;
      department?: string;
      badge_number?: string;
    }) => adminCreateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'User Created', description: 'Credentials have been provisioned.' });
    },
    onError: (err: any) => {
      toast({ title: 'Creation Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAdminUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role, reason }: { userId: string; role: string; reason?: string }) =>
      adminChangeUserRole(userId, { role, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'Role Updated', description: 'User permissions have been modified.' });
    },
    onError: (err: any) => {
      toast({ title: 'Role Update Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAdminUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, is_active, reason }: { userId: string; is_active: boolean; reason?: string }) =>
      adminUpdateUserStatus(userId, { is_active, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'Status Updated', description: 'User access modified.' });
    },
    onError: (err: any) => {
      toast({ title: 'Status Update Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAdminResetPassword() {
  return useMutation({
    mutationFn: ({ userId, new_password }: { userId: string; new_password: string }) =>
      adminForcePasswordReset(userId, { new_password }),
    onSuccess: () => {
      toast({ title: 'Password Reset', description: 'Temporary credentials deployed. User must change on next login.' });
    },
    onError: (err: any) => {
      toast({ title: 'Reset Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'User Removed', description: 'Identity has been soft-deleted.' });
    },
    onError: (err: any) => {
      toast({ title: 'Deletion Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

export function useAdminExportAuditLogs() {
  return useMutation({
    mutationFn: (params: { format?: string; start_date?: string; end_date?: string }) =>
      adminExportAuditLogs(params),
    onSuccess: (res: any) => {
      const data = unwrap(res);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Export Complete', description: 'Audit logs downloaded.' });
    },
    onError: (err: any) => {
      toast({ title: 'Export Failed', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    },
  });
}

// ─── Threat Intelligence ────────────────────────────────────
export function useThreatDashboard() {
  return useQuery({
    queryKey: ['threat-intel', 'dashboard'],
    queryFn: () => getThreatDashboard().then((r) => unwrap(r)),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useEvidenceRisk(evidenceId: string) {
  return useQuery({
    queryKey: ['threat-intel', 'evidence', evidenceId],
    queryFn: () => getEvidenceRisk(evidenceId).then((r) => unwrap(r)),
    enabled: !!evidenceId,
    staleTime: 60 * 1000,
  });
}

export function useCaseThreat(caseId: string) {
  return useQuery({
    queryKey: ['threat-intel', 'case', caseId],
    queryFn: () => getCaseThreat(caseId).then((r) => unwrap(r)),
    enabled: !!caseId,
    staleTime: 60 * 1000,
  });
}

export function useAnomalies() {
  return useQuery({
    queryKey: ['threat-intel', 'anomalies'],
    queryFn: () => getAnomalies().then((r) => unwrap(r)),
    staleTime: 60 * 1000,
  });
}

export function useDuplicates() {
  return useQuery({
    queryKey: ['threat-intel', 'duplicates'],
    queryFn: () => getDuplicates().then((r) => unwrap(r)),
    staleTime: 120 * 1000,
  });
}

export function useGraphData() {
  return useQuery({
    queryKey: ['threat-intel', 'graph'],
    queryFn: () => getGraphData().then((r) => unwrap(r)),
    staleTime: 60 * 1000,
  });
}

// ─── Session Logs (Security Layer) ──────────────────────────
export function useSessionLogs(params?: { limit?: number; user_id?: string; days?: number }) {
  return useQuery({
    queryKey: ['sessions', 'logs', params],
    queryFn: () => getSessionLogs(params).then((r) => unwrap(r)),
    staleTime: 30 * 1000,
  });
}

export function useSessionStats(params?: { days?: number }) {
  return useQuery({
    queryKey: ['sessions', 'stats', params],
    queryFn: () => getSessionStats(params).then((r) => unwrap(r)),
    staleTime: 30 * 1000,
  });
}

// ─── Evidence Timeline — Operational Layer ───────────────────
export function useEvidenceTimelineFeed(params?: {
  evidence_id?: string;
  limit?: number;
  action_type?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ['evidence-timeline', 'feed', params],
    queryFn: () => getEvidenceTimelineFeed(params).then((r) => unwrap(r)),
    staleTime: 30 * 1000,
  });
}

// ─── Notifications ───────────────────────────────────────────
export function useNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean; severity?: string; type?: string }, enabled: boolean = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params).then((r) => unwrap(r)),
    enabled: isAuthenticated && enabled,
    staleTime: 60 * 1000,  // Consider data fresh for 1 min (no unnecessary refetches)
    // No refetchInterval — only fetched on-demand when user opens the panel
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useEvidenceTimelineSummary() {
  return useQuery({
    queryKey: ['evidence-timeline', 'summary'],
    queryFn: () => getEvidenceTimelineSummary().then((r) => unwrap(r)),
    staleTime: 60 * 1000,
  });
}

// ─── Custody Chain — Legal Layer ─────────────────────────────
export function useCustodyChain(evidenceId: string, params?: { action?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['custody', 'chain', evidenceId, params],
    queryFn: () => getCustodyChain(evidenceId, params).then((r) => unwrap(r)),
    enabled: !!evidenceId,
    staleTime: 60 * 1000,
  });
}

export function useVerifyCustodyChain(evidenceId: string) {
  return useQuery({
    queryKey: ['custody', 'verify', evidenceId],
    queryFn: () => verifyCustodyChainFull(evidenceId).then((r) => unwrap(r)),
    enabled: !!evidenceId,
    staleTime: 30 * 1000,
  });
}
