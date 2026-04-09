import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { getPersistentHardwareID, getDeviceFingerprint } from '@/lib/forensic-id';

// Vite proxy rewrites /api/* → http://localhost:5000/*
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request Interceptor ─────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Inject Industry-Grade Forensic Headers
  config.headers['X-Hardware-ID'] = getPersistentHardwareID();
  config.headers['X-Device-Fingerprint'] = getDeviceFingerprint();

  return config;
});

// ─── Response Interceptor (auto-refresh on 401) ──────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh for 401s on NON-auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
        const payload = data?.data || data;
        const newToken = payload?.token;
        const newRefreshToken = payload?.refresh_token;

        if (!newToken) throw new Error('No token in refresh response');

        useAuthStore.getState().setTokens(newToken, newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────
export const loginApi = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const registerApi = (data: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: string;
  department?: string;
  badge_number?: string;
}) => api.post('/auth/register', data);

export const refreshTokenApi = (refresh_token: string) =>
  api.post('/auth/refresh', { refresh_token });

export const logoutApi = (refresh_token: string) =>
  api.post('/auth/logout', { refresh_token });

export const getMe = () => api.get('/auth/me');

export const updateProfile = (data: Record<string, any>) =>
  api.patch('/auth/profile', data);

// ─── Dashboard ────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats');

export const globalSearch = (params: { q: string; type?: string; page?: number; limit?: number }) =>
  api.get('/search', { params });

// ─── Evidence ─────────────────────────────────────────────────
export const getEvidenceList = (params?: { case_id?: string; page?: number; limit?: number }) =>
  api.get('/evidence', { params });

export const getEvidenceDetail = (id: string) => api.get(`/evidence/${id}`);

export const uploadEvidence = (formData: FormData, onProgress?: (percent: number) => void) =>
  api.post('/evidence/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    onUploadProgress: (progressEvent) => {
      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
      if (onProgress) onProgress(percent);
    },
  });

export const verifyEvidence = (id: string) => api.get(`/evidence/${id}/verify`);

export const analyzeEvidence = (id: string) => api.get(`/evidence/${id}/analyze`);

export const lockEvidence = (id: string, durationHours: number, reason: string) =>
  api.post(`/evidence/${id}/lock`, { durationHours, reason });

export const unlockEvidence = (id: string, reason: string) =>
  api.post(`/evidence/${id}/unlock`, { reason });

export const transferEvidence = (id: string, to_user_id: string, reason: string) =>
  api.post(`/evidence/${id}/transfer`, { to_user_id, reason });

export const validateChain = (id: string) => api.get(`/evidence/${id}/validate-chain`);

export const downloadEvidence = (id: string) =>
  api.get(`/evidence/${id}/download`, { responseType: 'blob' });

export const bulkEvidenceAction = (action: 'delete' | 'archive' | 'lock', evidence_ids: string[], reason?: string) =>
  api.post('/evidence/bulk', { action, evidence_ids, reason });

export const getEvidenceVersions = (id: string) => api.get(`/evidence/${id}/versions`);

// ─── Cases ────────────────────────────────────────────────────
export const getCases = (params?: { page?: number; limit?: number; status?: string }) =>
  api.get('/cases', { params });

export const getCaseDetail = (id: string) => api.get(`/cases/${id}`);

export const getCaseStats = () => api.get('/cases/stats');

export const createCase = (data: {
  title?: string;
  case_name?: string;
  description?: string;
  classification?: string;
  priority?: string;
  case_type?: string;
  status?: string;
}) => {
  const validClassifications = ['unclassified', 'confidential', 'restricted', 'official', 'secret', 'top_secret'];
  const cls = data.classification?.toLowerCase().replace(/\s+/g, '_');
  return api.post('/cases', {
    case_name: data.case_name || data.title,
    description: data.description,
    classification: cls && validClassifications.includes(cls) ? cls : 'unclassified',
    priority: data.priority || 'medium',
    case_type: data.case_type || 'investigation',
    status: data.status || 'open',
  });
};

export const updateCase = (
  id: string,
  data: { case_name?: string; description?: string; status?: string; priority?: string; classification?: string }
) => api.put(`/cases/${id}`, data);

export const deleteCase = (id: string) => api.delete(`/cases/${id}`);

export const addCaseNote = (id: string, content: string) =>
  api.post(`/cases/${id}/notes`, { content });

export const downloadReport = (id: string, name: string) => {
  return api.get(`/cases/${id}/report`, { responseType: 'blob' }).then(res => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${name}_Forensic_Report.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
};

export const exportCase = (id: string, name: string) => {
  return api.get(`/cases/${id}/export`, { responseType: 'blob' }).then(res => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${name}_Offline_Export.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
};

// ─── Custody ──────────────────────────────────────────────────
export const getCustodyTimeline = (evidenceId: string) =>
  api.get(`/evidence/${evidenceId}/timeline`);

export const getCustodyEvents = (params?: { evidence_id?: string; page?: number }) =>
  api.get('/custody/events', { params });

export const transferCustody = (
  evidenceId: string,
  data: { to_user_id: string; reason: string }
) => api.post(`/custody/transfer`, { evidence_id: evidenceId, ...data });

// ─── Verification ─────────────────────────────────────────────
export const verifyChainIntegrity = (evidenceId: string) =>
  api.get(`/evidence/${evidenceId}/validate-chain`);

export const verifyFileIntegrity = (evidenceId: string) =>
  api.get(`/evidence/${evidenceId}/verify`);

// ─── Reports ──────────────────────────────────────────────────
export const generateReport = (type: 'evidence' | 'case' | 'audit', id: string | null = null, format: 'json' | 'pdf' = 'pdf') => {
  let endpoint = `/reports/${type}`;
  if (id) endpoint += `/${id}`;
  return api.get(`${endpoint}?format=${format}`, { responseType: format === 'pdf' ? 'blob' : 'json' });
};

// ─── Audit ────────────────────────────────────────────────────
export const getAuditLogs = (params?: { page?: number; limit?: number; user_id?: string }) =>
  api.get('/audit/logs', { params });

export const getAuditAnalytics = (params?: { days?: number }) =>
  api.get('/audit/analytics', { params });

export const getAuditStats = () => api.get('/audit/stats');

// ─── Ledger ───────────────────────────────────────────────────
export const getLedgerAnchors = (params?: { page?: number; limit?: number }) =>
  api.get('/ledger/anchors', { params });

// ─── Users ────────────────────────────────────────────────────
export const getUsers = () => api.get('/users');

// ─── Admin ────────────────────────────────────────────────────
export const adminGetUsers = (params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) =>
  api.get('/admin/users', { params });

export const adminGetUserDetail = (userId: string) =>
  api.get(`/admin/users/${userId}`);

export const adminCreateUser = (data: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: string;
  department?: string;
  badge_number?: string;
}) => api.post('/admin/users', data);

export const adminChangeUserRole = (userId: string, data: { role: string; reason?: string }) =>
  api.patch(`/admin/users/${userId}/role`, data);

export const adminUpdateUserStatus = (userId: string, data: { is_active: boolean; reason?: string }) =>
  api.patch(`/admin/users/${userId}/status`, data);

export const adminForcePasswordReset = (userId: string, data: { new_password: string }) =>
  api.post(`/admin/users/${userId}/reset-password`, data);

export const adminDeleteUser = (userId: string) =>
  api.delete(`/admin/users/${userId}`);

export const adminBulkAction = (data: { user_ids: string[]; action: string; reason?: string }) =>
  api.post('/admin/users/bulk', data);

export const adminSecurityDashboard = () =>
  api.get('/admin/security/dashboard');

export const adminExportAuditLogs = (params?: { start_date?: string; end_date?: string; user_id?: string; format?: string }) =>
  api.get('/admin/audit/export', { params });

// ─── Threat Intelligence ──────────────────────────────────────
export const getThreatDashboard = () => api.get('/threat-intel/dashboard');

export const getEvidenceRisk = (evidenceId: string) =>
  api.get(`/threat-intel/evidence/${evidenceId}`);

export const getCaseThreat = (caseId: string) =>
  api.get(`/threat-intel/case/${caseId}`);

export const getAnomalies = () => api.get('/threat-intel/anomalies');

export const getDuplicates = () => api.get('/threat-intel/duplicates');

export const getGraphData = () => api.get('/threat-intel/graph');

// ─── Session Logs (Security Layer) ───────────────────────────
export const getSessionLogs = (params?: { limit?: number; user_id?: string; days?: number }) =>
  api.get('/sessions', { params });

export const getSessionStats = (params?: { days?: number }) =>
  api.get('/sessions/stats', { params });

// ─── Evidence Timeline (Operational Layer) ────────────────────
export const getEvidenceTimelineFeed = (params?: {
  evidence_id?: string;
  page?: number;
  limit?: number;
  action_type?: string;
  start_date?: string;
  end_date?: string;
}) => api.get('/evidence-timeline', { params });

export const getEvidenceTimelineSummary = () =>
  api.get('/evidence-timeline/summary');

// ─── Notifications ────────────────────────────────────────────
export const getNotifications = (params?: { page?: number; limit?: number; unreadOnly?: boolean; severity?: string; type?: string }) =>
  api.get('/notifications', { params });

export const markNotificationRead = (id: string) =>
  api.patch(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.post('/notifications/mark-all-read');

export const dismissNotification = (id: string) =>
  api.delete(`/notifications/${id}`);

// ─── Custody Chain Verification ───────────────────────────────
export const getCustodyChain = (evidenceId: string, params?: { action?: string; startDate?: string; endDate?: string }) =>
  api.get(`/evidence/${evidenceId}/chain`, { params });

export const verifyCustodyChainFull = (evidenceId: string) =>
  api.get(`/evidence/${evidenceId}/verify-chain`);

export default api;
