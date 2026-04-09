import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Single required role (legacy support) */
  requiredRole?: string;
  /** Multiple allowed roles — user must have one of them */
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, requiredRole, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (user?.role || '').toLowerCase().trim();

  // Canonical role mapping
  const roleAliases: Record<string, string[]> = {
    admin: ['admin', 'administrator', 'super_user', 'superuser'],
    investigator: ['investigator', 'analyst', 'agent'],
    auditor: ['auditor', 'reviewer', 'legal'],
    viewer: ['viewer', 'readonly', 'observer'],
  };

  const canonicalize = (role: string): string => {
    const r = role.toLowerCase().trim();
    for (const [canonical, aliases] of Object.entries(roleAliases)) {
      if (canonical === r || aliases.includes(r)) return canonical;
    }
    return r;
  };

  const canonicalUserRole = canonicalize(userRole);

  // Multi-role check
  if (allowedRoles && allowedRoles.length > 0) {
    const allowed = allowedRoles.map(canonicalize);
    if (!allowed.includes(canonicalUserRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Single role check (legacy)
  if (requiredRole) {
    const required = canonicalize(requiredRole);
    if (canonicalUserRole !== required) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
