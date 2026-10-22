import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/auth.context.js';
import { fetchCredentials } from '../../services/credential.api.js';
import { fetchCredentialHealthList } from '../../services/password-health.api.js';
import { fetchIncomingShares } from '../../services/credential-share.api.js';
import { NavigationTab } from '../layout/AppShell.js';
import {
  KeyRound,
  Activity,
  Share2,
  Plus,
  AlertTriangle,
  ArrowRight,
  RotateCw,
  Star,
} from 'lucide-react';
import { ICredentialListItem, PasswordHealthDetailsResponse } from '@credential-manager/types';

interface EmployeeDashboardOverviewProps {
  onNavigateTab: (tab: NavigationTab) => void;
  onAddCredential?: () => void;
}

export const EmployeeDashboardOverview: React.FC<EmployeeDashboardOverviewProps> = ({
  onNavigateTab,
  onAddCredential,
}) => {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<ICredentialListItem[]>([]);
  const [healthData, setHealthData] = useState<PasswordHealthDetailsResponse | null>(null);
  const [pendingSharesCount, setPendingSharesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setLoading(true);
      try {
        const [credsRes, healthRes, sharesRes] = await Promise.allSettled([
          fetchCredentials({ limit: 6 }),
          fetchCredentialHealthList(),
          fetchIncomingShares(),
        ]);

        if (isMounted) {
          if (credsRes.status === 'fulfilled') {
            setCredentials(credsRes.value.items);
          }
          if (healthRes.status === 'fulfilled') {
            setHealthData(healthRes.value);
          }
          if (sharesRes.status === 'fulfilled') {
            const pending = sharesRes.value.shares.filter((s) => s.status === 'PENDING').length;
            setPendingSharesCount(pending);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalCreds = healthData?.summary?.totalCredentials ?? credentials.length;
  const healthScore = healthData?.summary?.score ?? 100;
  const weakCount = healthData?.summary?.weakCredentials ?? 0;
  const reusedCount = healthData?.summary?.reusedCredentials ?? 0;
  const needsAttentionCount = weakCount + reusedCount + (healthData?.summary?.oldCredentials ?? 0);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Welcome & Quick Action Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'var(--bg-surface-elevated)',
          padding: '1.15rem 1.35rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            Welcome back, {user?.name || 'Employee'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Employee ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{user?.employeeId}</strong> • Department: {user?.department || 'Faculty Services'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={onAddCredential}>
            <Plus size={14} />
            Add Credential
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('vault')}>
            <KeyRound size={14} />
            View Credentials
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('health')}>
            <Activity size={14} />
            Check Password Health
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('shared')}>
            <Share2 size={14} />
            Shared Credentials
          </button>
        </div>
      </div>

      {/* 4 Focused Metric Tiles */}
      <div className="grid-4">
        {/* Tile 1: Saved Credentials */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('vault')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Saved Credentials</span>
            <KeyRound size={15} color="var(--info)" />
          </div>
          <div className="metric-card-value">{totalCreds}</div>
          <div className="metric-card-footer">
            <span style={{ color: 'var(--text-secondary)' }}>Protected securely</span>
          </div>
        </div>

        {/* Tile 2: Password Health */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('health')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Password Health</span>
            <Activity size={15} color={getHealthColor(healthScore)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="metric-card-value" style={{ color: getHealthColor(healthScore) }}>
              {healthScore}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div className="metric-card-footer">
            <span style={{ color: getHealthColor(healthScore) }}>
              {healthScore >= 80 ? '● Good Condition' : healthScore >= 60 ? '● Needs Attention' : '● Action Recommended'}
            </span>
          </div>
        </div>

        {/* Tile 3: Needs Attention */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('health')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Needing Attention</span>
            <AlertTriangle size={15} color={needsAttentionCount > 0 ? 'var(--warning)' : 'var(--success)'} />
          </div>
          <div className="metric-card-value" style={{ color: needsAttentionCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {needsAttentionCount}
          </div>
          <div className="metric-card-footer">
            <span>{weakCount} weak • {reusedCount} reused</span>
          </div>
        </div>

        {/* Tile 4: Pending Shares */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('shared')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Shared With You</span>
            <Share2 size={15} color={pendingSharesCount > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
          </div>
          <div className="metric-card-value" style={{ color: pendingSharesCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {pendingSharesCount}
          </div>
          <div className="metric-card-footer">
            <span>{pendingSharesCount > 0 ? 'Requests pending' : 'All up to date'}</span>
          </div>
        </div>
      </div>

      {/* Health Alert Banner if Action Needed */}
      {needsAttentionCount > 0 && (
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={17} color="var(--warning)" />
            <div>
              <span style={{ fontWeight: 600, color: '#fde68a', fontSize: '0.84rem' }}>
                {needsAttentionCount} Saved Password{needsAttentionCount > 1 ? 's' : ''} Need Attention
              </span>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Updating weak or reused passwords helps keep your accounts protected.
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('health')}
            style={{ color: '#fde68a', borderColor: 'var(--warning-border)' }}
          >
            Review Passwords <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Recent Saved Credentials Preview Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <KeyRound size={16} color="var(--info)" />
            <h3 className="card-title">Recent Credentials</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigateTab('vault')}
          >
            View All ({totalCreds}) <ArrowRight size={12} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RotateCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Loading credentials...</div>
          </div>
        ) : credentials.length === 0 ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.85rem' }}>You haven't added any credentials yet.</p>
            <button className="btn btn-primary btn-sm" onClick={onAddCredential}>
              <Plus size={14} /> Add Credential
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account Name & Website</th>
                  <th>Username</th>
                  <th>Category</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.slice(0, 5).map((cred) => (
                  <tr key={cred.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {cred.favorite && <Star size={12} fill="#facc15" color="#facc15" />}
                        <strong style={{ color: 'var(--text-primary)' }}>{cred.title}</strong>
                        {cred.website && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ({cred.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {cred.username}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                        {cred.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(cred.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onNavigateTab('vault')}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
