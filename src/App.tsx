import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EvidenceListPage from "./pages/EvidenceListPage";
import EvidenceDetailPage from "./pages/EvidenceDetailPage";
import UploadEvidencePage from "./pages/UploadEvidencePage";
import VerifyPage from "./pages/VerifyPage";
import CustodyTimelinePage from "./pages/CustodyTimelinePage";
import CaseManagementPage from "./pages/CaseManagementPage";
import EvidenceTimelinePage from "./pages/EvidenceTimelinePage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import AdminPage from "./pages/AdminPage";
import SettingsPage from "./pages/SettingsPage";
import ThreatIntelPage from "./pages/ThreatIntelPage";
import GraphPage from "./pages/GraphPage";
import ActivityPage from "./pages/ActivityPage";
import NotificationCenterPage from "./pages/NotificationCenterPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,    // 15 seconds — much shorter for real-time feel
      gcTime: 5 * 60 * 1000,   // 5 minutes garbage collection (formerly cacheTime)
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/evidence" element={<EvidenceListPage />} />
              <Route path="/evidence/:id" element={<EvidenceDetailPage />} />
              <Route path="/upload" element={<ProtectedRoute allowedRoles={['admin', 'investigator']}><UploadEvidencePage /></ProtectedRoute>} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/verify/:id" element={<VerifyPage />} />
              <Route path="/custody" element={<CustodyTimelinePage />} />
              <Route path="/cases" element={<ProtectedRoute allowedRoles={['admin', 'investigator']}><CaseManagementPage /></ProtectedRoute>} />
              <Route path="/timeline" element={<EvidenceTimelinePage />} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'investigator', 'auditor']}><ReportsPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin', 'auditor']}><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute allowedRoles={['admin', 'investigator']}><ActivityPage /></ProtectedRoute>} />
              <Route path="/sessions" element={<Navigate to="/activity" replace />} />
              <Route path="/threat-intel" element={<ProtectedRoute allowedRoles={['admin', 'investigator', 'auditor']}><ThreatIntelPage /></ProtectedRoute>} />
              <Route path="/graph" element={<ProtectedRoute allowedRoles={['admin', 'investigator']}><GraphPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<NotificationCenterPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
