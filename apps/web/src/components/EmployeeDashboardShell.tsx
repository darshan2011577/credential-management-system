import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth.context.js';
import { ChangePasswordModal } from './ChangePasswordModal.js';
import { CredentialVaultView } from './credentials/CredentialVaultView.js';
import { PasswordHealthDashboard } from './health/PasswordHealthDashboard.js';
import { SharedCredentialsView } from './sharing/SharedCredentialsView.js';
import { NotificationBell } from './notifications/NotificationBell.js';
import { LicenseStatusBadge } from './license/LicenseStatusBadge.js';
import { fetchIncomingShares } from '../services/credential-share.api.js';
import {
  UserCheck,
  LogOut,
  Layers,
  Lock,
  HeartHandshake,
  Activity,
  KeyRound,
  Share2,
} from 'lucide-react';

interface EmployeeDashboardShellProps {
  onToggleDiagnostics: () => void;
  showDiagnostics: boolean;
}

export const EmployeeDashboardShell: React.FC<EmployeeDashboardShellProps> = ({
  onToggleDiagnostics,
  showDiagnostics,
}) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'vault' | 'health' | 'shared' | 'notifications'>('vault');
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
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <UserCheck size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.name || 'Employee'}</h2>
              <span className="badge badge-green" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                EMPLOYEE ROLE
              </span>
              <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                <span className="pulse-dot" />
                ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Employee ID: <strong style={{ color: '#ffffff' }}>{user?.employeeId}</strong> • Email: {user?.email} • Department: {user?.department || 'Faculty Services'}
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
        }}
      >
        <button
          className={`btn ${activeTab === 'vault' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('vault')}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem' }}
        >
          <KeyRound size={16} />
          Credential Vault (AES-256)
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
      </div>

      {/* Active Tab View */}
      {activeTab === 'vault' ? (
        <CredentialVaultView />
      ) : activeTab === 'health' ? (
        <PasswordHealthDashboard onNavigateToVault={() => setActiveTab('vault')} />
      ) : (
        <SharedCredentialsView onRefreshBadge={(cnt) => setPendingSharesCount(cnt)} />
      )}


      {/* Upcoming Modules Summary Cards */}
      <div className="grid-2" style={{ marginTop: '0.5rem' }}>
        {/* Module 2: Access & Sharing Requests */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <HeartHandshake size={20} color="#a855f7" />
              <h3 className="card-title">Sharing & Access Requests</h3>
            </div>
            <span className="badge badge-amber">Phase 8 Roadmap</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Request temporary access to department credentials with admin approval and time-bounded permissions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div className="metric-row">
              <span className="metric-label">Time-Bounded Access</span>
              <span className="badge badge-blue">TTL Expiration Supported</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Audit Trail</span>
              <span className="metric-value">Logged & Verified</span>
            </div>
          </div>
        </div>

        {/* Module 3: Security & Session Auditing */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Activity size={20} color="#10b981" />
              <h3 className="card-title">Security & Encryption Invariants</h3>
            </div>
            <span className="badge badge-green">Phase 6 + 7 Active</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            Zero-plaintext storage with AES-256-GCM ciphertexts and transient in-memory health entropy analysis.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div className="metric-row">
              <span className="metric-label">Storage Integrity</span>
              <span className="badge badge-green">AES-256-GCM + GMAC</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Health Cache</span>
              <span className="badge badge-blue">Redis (Metadata Only)</span>
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

