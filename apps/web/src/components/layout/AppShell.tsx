import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/auth.context.js';
import { useTheme } from '../../context/theme.context.js';
import { APP_CONFIG } from '@credential-manager/config';
import { HealthResponse } from '@credential-manager/types';
import { fetchIncomingShares } from '../../services/credential-share.api.js';
import { fetchUnreadNotificationCount } from '../../services/notification.api.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { LicenseStatusModal } from '../license/LicenseStatusModal.js';
import { ChangePasswordModal } from '../ChangePasswordModal.js';
import {
  KeyRound,
  TrendingUp,
  Users,
  Activity,
  Share2,
  Bell,
  FileSpreadsheet,
  Lock,
  LogOut,
  User,
  AlertTriangle,
  RotateCw,
  Sun,
  Moon,
} from 'lucide-react';

export type NavigationTab =
  | 'dashboard'
  | 'employees'
  | 'vault'
  | 'health'
  | 'shared'
  | 'notifications'
  | 'audit'
  | 'license'
  | 'profile';

interface AppShellProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  children: React.ReactNode;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError?: string;
  crashError: string | null;
  onRestartService: () => Promise<void>;
  restarting: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  children,
  health,
  healthLoading,
  healthError,
  crashError,
  onRestartService,
  restarting,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState<number>(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  const isAdmin = user?.role === 'ADMIN';
  const isConnected = Boolean(health && (health.status === 'healthy' || health.status === 'degraded'));

  // Load badge counts
  useEffect(() => {
    if (!user) return;

    fetchIncomingShares()
      .then((res) => {
        const pending = res.shares.filter((s) => s.status === 'PENDING').length;
        setPendingSharesCount(pending);
      })
      .catch(() => {});

    fetchUnreadNotificationCount()
      .then((res) => {
        setUnreadNotificationCount(res.unreadCount || 0);
      })
      .catch(() => {});
  }, [user, activeTab]);

  const getPageTitle = (): { title: string; subtitle: string; icon: React.ReactNode } => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Dashboard',
          subtitle: isAdmin
            ? 'Overview of employees, credentials, and password security.'
            : 'Overview of your saved credentials and password security.',
          icon: <TrendingUp size={16} color="var(--primary)" />,
        };
      case 'employees':
        return {
          title: 'Employees',
          subtitle: 'Manage employee accounts and view their security status.',
          icon: <Users size={16} color="var(--purple)" />,
        };
      case 'vault':
        return {
          title: 'My Credentials',
          subtitle: 'Keep your account information organized and securely protected.',
          icon: <KeyRound size={16} color="var(--info)" />,
        };
      case 'health':
        return {
          title: 'Password Health',
          subtitle: 'Check the strength and security of your saved passwords.',
          icon: <Activity size={16} color="var(--success)" />,
        };
      case 'shared':
        return {
          title: 'Credential Sharing',
          subtitle: 'Share selected account information with another employee when access is needed.',
          icon: <Share2 size={16} color="#c084fc" />,
        };
      case 'notifications':
        return {
          title: 'Notifications',
          subtitle: 'Stay updated about important changes and requests.',
          icon: <Bell size={16} color="#38bdf8" />,
        };
      case 'audit':
        return {
          title: 'Activity',
          subtitle: 'Review recent account and security activity across the organization.',
          icon: <FileSpreadsheet size={16} color="var(--warning)" />,
        };
      case 'profile':
        return {
          title: 'My Profile',
          subtitle: 'View your account details and update your password.',
          icon: <User size={16} color="var(--primary)" />,
        };
      default:
        return {
          title: APP_CONFIG.appName,
          subtitle: 'Manage your passwords and account information securely.',
          icon: <KeyRound size={16} />,
        };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <div className="app-shell">
      {/* ----------------- SIDEBAR ----------------- */}
      <aside className="app-sidebar">
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <KeyRound size={18} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">{APP_CONFIG.appName}</span>
            <span className="sidebar-brand-sub">Password Manager</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="sidebar-content">
          {/* Main Navigation Group */}
          <div className="sidebar-nav-group">
            <span className="sidebar-group-label">Navigation</span>

            {/* Dashboard */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab('dashboard')}
            >
              <div className="sidebar-btn-content">
                <TrendingUp size={16} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* Admin-only: Employees */}
            {isAdmin && (
              <button
                className={`sidebar-nav-btn ${activeTab === 'employees' ? 'active' : ''}`}
                onClick={() => onSelectTab('employees')}
              >
                <div className="sidebar-btn-content">
                  <Users size={16} />
                  <span>Employees</span>
                </div>
                <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                  Admin
                </span>
              </button>
            )}

            {/* Credential Vault */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => onSelectTab('vault')}
            >
              <div className="sidebar-btn-content">
                <KeyRound size={16} />
                <span>My Credentials</span>
              </div>
            </button>

            {/* Password Health */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'health' ? 'active' : ''}`}
              onClick={() => onSelectTab('health')}
            >
              <div className="sidebar-btn-content">
                <Activity size={16} />
                <span>Password Health</span>
              </div>
            </button>

            {/* Credential Sharing */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => onSelectTab('shared')}
            >
              <div className="sidebar-btn-content">
                <Share2 size={16} />
                <span>Sharing</span>
              </div>
              {pendingSharesCount > 0 && (
                <span
                  style={{
                    background: 'var(--danger)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  {pendingSharesCount}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => onSelectTab('notifications')}
            >
              <div className="sidebar-btn-content">
                <Bell size={16} />
                <span>Notifications</span>
              </div>
              {unreadNotificationCount > 0 && (
                <span
                  style={{
                    background: 'var(--info)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>

          {/* Admin Activity / Governance Group */}
          {isAdmin && (
            <div className="sidebar-nav-group">
              <span className="sidebar-group-label">Management</span>

              {/* Activity */}
              <button
                className={`sidebar-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => onSelectTab('audit')}
              >
                <div className="sidebar-btn-content">
                  <FileSpreadsheet size={16} />
                  <span>Activity</span>
                </div>
              </button>
            </div>
          )}

          {/* Account Settings */}
          <div className="sidebar-nav-group">
            <span className="sidebar-group-label">Account</span>

            {/* Profile Settings */}
            <button
              className={`sidebar-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => onSelectTab('profile')}
            >
              <div className="sidebar-btn-content">
                <User size={16} />
                <span>My Profile</span>
              </div>
            </button>
          </div>
        </div>

        {/* Sidebar Footer / User Profile */}
        <div className="sidebar-footer">
          <div className="user-profile-tile">
            <div className="user-profile-info">
              <div className="user-avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="user-meta-name">{user?.name || 'Authorized User'}</span>
                <span className="user-meta-role">
                  {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
                </span>
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={logout}
              title="Sign Out"
              style={{ padding: '0.3rem', color: 'var(--danger)' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ----------------- MAIN VIEWPORT ----------------- */}
      <div className="app-main">
        {/* Topbar Header */}
        <header className="app-topbar">
          <div className="topbar-left">
            <div className="topbar-title">
              {pageInfo.icon}
              <span>{pageInfo.title}</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notification Bell */}
            <NotificationBell onNavigateTab={(tab) => onSelectTab(tab as NavigationTab)} />

            {/* Theme Switcher Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
              style={{ padding: '0.35rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            {/* Change Password Quick Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPasswordModal(true)}
              title="Change Password"
            >
              <Lock size={13} />
              <span>Password</span>
            </button>
          </div>
        </header>

        {/* Scrollable Viewport Content */}
        <main className="app-viewport">
          {/* Service Disconnect / Crash Warning Banner */}
          {(crashError || (!isConnected && !healthLoading)) && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#fca5a5', fontSize: '0.88rem' }}>
                    Service Connection Notice
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {crashError ||
                      healthError ||
                      'Unable to connect to application service. Please make sure the service is running.'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={onRestartService}
                disabled={restarting}
              >
                <RotateCw size={13} className={restarting ? 'spin' : ''} />
                {restarting ? 'Reconnecting...' : 'Retry Connection'}
              </button>
            </div>
          )}

          {/* Render Active View Content */}
          {children}
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      {/* License Modal */}
      {showLicenseModal && (
        <LicenseStatusModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
        />
      )}
    </div>
  );
};
