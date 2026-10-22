import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.context.js';
import { ChangePasswordModal } from './ChangePasswordModal.js';
import { CredentialVaultView } from './credentials/CredentialVaultView.js';
import { PasswordHealthDashboard } from './health/PasswordHealthDashboard.js';
import { SharedCredentialsView } from './sharing/SharedCredentialsView.js';
import { AdminAuditLogView } from './audit/AdminAuditLogView.js';
import { AdminDashboardOverview } from './admin/AdminDashboardOverview.js';
import { NotificationBell } from './notifications/NotificationBell.js';
import { LicenseStatusBadge } from './license/LicenseStatusBadge.js';
import { fetchIncomingShares } from '../services/credential-share.api.js';
import {
  ShieldAlert,
  LogOut,
  Layers,
  Lock,
  Users,
  Shield,
  Activity,
  KeyRound,
  Share2,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';


interface AdminDashboardShellProps {
  onToggleDiagnostics: () => void;
  showDiagnostics: boolean;
}

export const AdminDashboardShell: React.FC<AdminDashboardShellProps> = ({
  onToggleDiagnostics,
  showDiagnostics,
}) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'vault' | 'health' | 'shared' | 'notifications' | 'audit' | 'license' | 'profile'>('dashboard');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState<number>(0);

  useEffect(() => {
    fetchIncomingShares()
      .then((res) => {
        const pending = res.shares.filter((s) => s.status === 'PENDING').length;
        setPendingSharesCount(pending);
      })
      .catch(() => {
        // Silently handle if unauthenticated or network error
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Profile Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
            }}
          >
            <ShieldAlert size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.name || 'Administrator'}</h2>
              <span className="badge badge-purple" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                SYSTEM ADMIN
              </span>
              <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                <span className="pulse-dot" />
                ROOT PRIVILEGES
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Employee ID: <strong style={{ color: '#ffffff' }}>{user?.employeeId}</strong> • Email: {user?.email} • Department: {user?.department || 'Information Technology'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <LicenseStatusBadge />
          <NotificationBell onNavigateTab={(tab) => setActiveTab(tab)} />
          <button
            className={`btn ${showDiagnostics ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleDiagnostics}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            <Layers size={14} />
            {showDiagnostics ? 'Hide Diagnostics' : 'System Architecture'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowPasswordModal(true)}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            <Lock size={14} />
            Change Password
          </button>
          <button
            className="btn btn-secondary"
            onClick={logout}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', color: '#fb7185' }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem' }}
        >
          <TrendingUp size={16} />
          Security Dashboard
        </button>
        <button
          className={`btn ${activeTab === 'vault' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('vault')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem' }}
        >
          <KeyRound size={16} />
          Admin Credential Vault
        </button>
        <button
          className={`btn ${activeTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('health')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem' }}
        >
          <Activity size={16} />
          Password Health Analysis
        </button>
        <button
          className={`btn ${activeTab === 'shared' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('shared')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <Share2 size={16} />
          Shared Credentials
          {pendingSharesCount > 0 && (
            <span
              style={{
                background: '#fb7185',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
              }}
            >
              {pendingSharesCount}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <FileSpreadsheet size={16} />
          Security Audit Logs
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'dashboard' ? (
        <AdminDashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
      ) : activeTab === 'vault' ? (
        <CredentialVaultView />
      ) : activeTab === 'health' ? (
        <PasswordHealthDashboard onNavigateToVault={() => setActiveTab('vault')} />
      ) : activeTab === 'shared' ? (
        <SharedCredentialsView onRefreshBadge={(cnt) => setPendingSharesCount(cnt)} />
      ) : (
        <AdminAuditLogView />
      )}


      {/* Admin Module Shell Cards */}
      <div className="grid-2" style={{ marginTop: '0.5rem' }}>
        {/* Module 1: Employee Management */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Users size={20} color="#a855f7" />
              <h3 className="card-title">Employee Governance</h3>
            </div>
            <span className="badge badge-purple">Phase 5 Module</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Centralized employee lifecycle management, role delegation, account status toggles, and security isolation.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div className="metric-row">
              <span className="metric-label">RBAC Enforcement</span>
              <span className="badge badge-green">ADMIN Authoritative</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Account Status Policy</span>
              <span className="metric-value">Active / Inactive / Suspended</span>
            </div>
          </div>
        </div>

        {/* Module 2: Security & Session Auditing */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Shield size={20} color="#10b981" />
              <h3 className="card-title">Session & Security State</h3>
            </div>
            <span className="badge badge-green">Active & Monitored</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Short-lived JWT access tokens, Redis refresh session rotation, HTTP-only secure cookie transport, and brute-force rate limiters.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div className="metric-row">
              <span className="metric-label">Session Transport</span>
              <span className="badge badge-green">HTTP-Only Cookies</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Refresh Token Rotation</span>
              <span className="badge badge-green">Redis Active (7d)</span>
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

