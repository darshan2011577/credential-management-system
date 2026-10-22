import React, { useEffect, useState, useCallback } from 'react';
import { HealthResponse } from '@credential-manager/types';
import { fetchApiHealth } from './services/api.js';
import { AuthProvider, useAuth } from './auth/auth.context.js';
import { ThemeProvider } from './context/theme.context.js';
import { LicenseProvider } from './context/license.context.js';
import { LicenseGuard } from './components/license/LicenseGuard.js';
import { LoginCard } from './components/LoginCard.js';
import { AppShell, NavigationTab } from './components/layout/AppShell.js';
import { AdminDashboardOverview } from './components/admin/AdminDashboardOverview.js';
import { AdminEmployeesView } from './components/admin/AdminEmployeesView.js';
import { AdminAuditLogView } from './components/audit/AdminAuditLogView.js';
import { EmployeeDashboardOverview } from './components/employee/EmployeeDashboardOverview.js';
import { CredentialVaultView } from './components/credentials/CredentialVaultView.js';
import { PasswordHealthDashboard } from './components/health/PasswordHealthDashboard.js';
import { SharedCredentialsView } from './components/sharing/SharedCredentialsView.js';
import { NotificationsView } from './components/notifications/NotificationsView.js';
import { ProfileSecurityView } from './components/profile/ProfileSecurityView.js';
import { ExternalShareAccessView } from './components/sharing/ExternalShareAccessView.js';
import { RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Diagnostics & System Health State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | undefined>(undefined);

  // Desktop State from Electron Bridge
  const [crashError, setCrashError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<boolean>(false);

  // Check for public share token in URL path (/access-share/:token) or search (?shareToken=xyz or ?token=xyz)
  const pathParts = window.location.pathname.split('/');
  const shareTokenIndex = pathParts.findIndex((p) => p === 'access-share');
  let publicShareToken: string | null = null;
  if (shareTokenIndex !== -1 && pathParts[shareTokenIndex + 1]) {
    publicShareToken = pathParts[shareTokenIndex + 1];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    publicShareToken = urlParams.get('shareToken') || urlParams.get('token');
  }

  // If a public share token is present, render the external access portal directly without login
  if (publicShareToken) {
    return <ExternalShareAccessView token={publicShareToken} />;
  }

  // Probe API Health via direct REST HTTP
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    const result = await fetchApiHealth();
    setHealth(result.data);
    setHealthError(result.error);
    setHealthLoading(false);
  }, []);

  // Initialize Desktop Bridge
  useEffect(() => {
    if (window.desktop) {
      const unsubscribe = window.desktop.onApiCrashed((errorMsg) => {
        setCrashError(errorMsg);
        setHealth(null);
      });

      return () => unsubscribe();
    }
  }, []);

  // Initial Health Check & Polling Loop
  useEffect(() => {
    checkHealth();
    const interval = setInterval(() => {
      checkHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleRestartService = async () => {
    setRestarting(true);
    setCrashError(null);
    try {
      if (window.desktop) {
        await window.desktop.restartApi();
      }
      await new Promise((res) => setTimeout(res, 1000));
      await checkHealth();
    } catch (err) {
      console.error('Failed to restart service', err);
    } finally {
      setRestarting(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-app)' }}>
        <RefreshCw size={28} className="spin" color="var(--primary)" />
      </div>
    );
  }

  // Unauthenticated Login Flow
  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <LoginCard />
        </main>
      </div>
    );
  }

  // Authenticated Unified Desktop Shell
  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
      }}
      health={health}
      healthLoading={healthLoading}
      healthError={healthError}
      crashError={crashError}
      onRestartService={handleRestartService}
      restarting={restarting}
    >
      {activeTab === 'dashboard' ? (
        user?.role === 'ADMIN' ? (
          <AdminDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        ) : (
          <EmployeeDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        )
      ) : activeTab === 'employees' ? (
        user?.role === 'ADMIN' ? (
          <AdminEmployeesView />
        ) : (
          <EmployeeDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        )
      ) : activeTab === 'vault' ? (
        <CredentialVaultView />
      ) : activeTab === 'health' ? (
        <PasswordHealthDashboard onNavigateToVault={() => setActiveTab('vault')} />
      ) : activeTab === 'shared' ? (
        <SharedCredentialsView onRefreshBadge={() => {}} />
      ) : activeTab === 'notifications' ? (
        <NotificationsView onNavigateTab={(tab) => setActiveTab(tab)} />
      ) : activeTab === 'audit' ? (
        user?.role === 'ADMIN' ? (
          <AdminAuditLogView />
        ) : (
          <EmployeeDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        )
      ) : activeTab === 'profile' ? (
        <ProfileSecurityView />
      ) : null}
    </AppShell>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LicenseProvider>
        <LicenseGuard>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
        </LicenseGuard>
      </LicenseProvider>
    </ThemeProvider>
  );
};

export default App;
