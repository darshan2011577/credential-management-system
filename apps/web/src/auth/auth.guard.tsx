import React from 'react';
import { UserRole } from '@credential-manager/types';
import { useAuth } from './auth.context.js';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback = null }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <RefreshCw size={24} className="pulse-dot" color="var(--color-primary)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '2rem auto', textAlign: 'center' }}>
        <ShieldAlert size={36} color="#f43f5e" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ color: '#fb7185', marginBottom: '0.5rem' }}>Access Denied (403 Forbidden)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Your account ({user?.role || 'Guest'}) does not have permission to view this section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
