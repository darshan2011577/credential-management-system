import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminDashboardData,
  AdminDashboardDateRange,
} from '@credential-manager/types';
import { fetchAdminDashboardStats } from '../../services/admin-dashboard.api.js';
import { NavigationTab } from '../layout/AppShell.js';
import {
  Users,
  KeyRound,
  Activity,
  Share2,
  FileSpreadsheet,
  ShieldCheck,
  Clock,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AdminDashboardOverviewProps {
  onNavigateTab: (tab: NavigationTab) => void;
}

const formatActionDescription = (action: string, description?: string): string => {
  const map: Record<string, string> = {
    LOGIN_SUCCESS: 'Signed in successfully',
    LOGIN_FAILURE: 'Sign-in attempt failed',
    LOGOUT: 'Signed out',
    CREDENTIAL_CREATED: 'Added credential',
    CREDENTIAL_UPDATED: 'Updated credential',
    CREDENTIAL_DELETED: 'Deleted credential',
    CREDENTIAL_REVEALED: 'Password viewed',
    PASSWORD_REVEAL: 'Password viewed',
    PASSWORD_HEALTH_CHECK: 'Password security checked',
    PASSWORD_HEALTH_ANALYZED: 'Password security checked',
    SHARE_CREATED: 'Credential sharing request sent',
    SHARE_APPROVED: 'Credential sharing request approved',
    SHARE_REJECTED: 'Credential sharing request declined',
    SHARE_REVOKED: 'Credential share access revoked',
    USER_CREATED: 'Employee added',
    USER_UPDATED: 'Employee updated',
    PASSWORD_CHANGED: 'Password changed',
  };

  if (map[action]) return map[action];
  if (description && !description.includes('_')) return description;
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<AdminDashboardDateRange>('LAST_30_DAYS');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDashboardStats({
        dateRange,
        employeeId: selectedEmployeeId || undefined,
      });
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve dashboard metrics';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedEmployeeId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const formatTimeAgo = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return isoString;
    }
  };

  if (isLoading && !data) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <RotateCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Loading Dashboard...</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Aggregating employee and credential information
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--danger-border)' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 0.75rem' }} />
        <h3 style={{ color: '#fca5a5', fontSize: '1.1rem', marginBottom: '0.35rem' }}>Unable to Load Dashboard Data</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
          {error}
        </p>
        <button className="btn btn-primary btn-sm" onClick={loadStats}>
          <RotateCw size={13} /> Retry Connection
        </button>
      </div>
    );
  }

  const employees = data?.employees || { total: 0, active: 0, inactive: 0, suspended: 0, recentlyCreated: 0 };
  const credentials = data?.credentials || { total: 0, active: 0, favorite: 0, byCategory: { SOCIAL: 0, WORK: 0, FINANCE: 0, DEVELOPMENT: 0, OTHER: 0 }, recentlyCreated: 0 };
  const health = data?.passwordHealth || { totalAnalyzed: 0, healthy: 0, needsAttention: 0, atRisk: 0, critical: 0, weakCount: 0, reusedCount: 0, oldPasswordCount: 0, policyViolations: 0, averageScore: 100 };
  const sharing = data?.sharing || { total: 0, pending: 0, approved: 0, rejected: 0, revoked: 0, expired: 0, recentShares: [] };
  const audit = data?.audit || { totalEvents: 0, byCategory: { AUTH: 0, CREDENTIAL: 0, SECURITY: 0, SYSTEM: 0, ADMIN: 0 }, eventTimeline: [] };
  const recentActivity = data?.recentActivity || [];
  const employeeOverview = data?.employeeOverview || [];
  const passwordsNeedingAttention = (health.weakCount || 0) + (health.reusedCount || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Filter & Refresh Controls */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          padding: '0.9rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--primary-border)',
            }}
          >
            <TrendingUp size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Dashboard Overview
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Summary of employees, credentials, and password security
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Employee Filter */}
          {employeeOverview.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="select"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
              >
                <option value="">All Employees ({employees.total})</option>
                {employeeOverview.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {(['TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'ALL_TIME'] as AdminDashboardDateRange[]).map(
              (range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`btn btn-sm ${dateRange === range ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                >
                  {range === 'TODAY'
                    ? 'Today'
                    : range === 'LAST_7_DAYS'
                      ? '7D'
                      : range === 'LAST_30_DAYS'
                        ? '30D'
                        : range === 'THIS_MONTH'
                          ? 'This Month'
                          : 'All Time'}
                </button>
              )
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadStats}
            disabled={isLoading}
            title="Refresh dashboard"
          >
            <RotateCw size={13} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* 5 Structured Overview Summary Cards */}
      <div className="grid-6">
        {/* Card 1: Total Employees */}
        <div className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('employees')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Total Employees</span>
            <Users size={14} color="var(--purple)" />
          </div>
          <div className="metric-card-value">{employees.total}</div>
          <div className="metric-card-footer">
            <span style={{ color: 'var(--success)' }}>● {employees.active} Active</span>
          </div>
        </div>

        {/* Card 2: Saved Credentials */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('vault')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Saved Credentials</span>
            <KeyRound size={14} color="var(--info)" />
          </div>
          <div className="metric-card-value">{credentials.total}</div>
          <div className="metric-card-footer">
            <span>★ {credentials.favorite} Favorites</span>
          </div>
        </div>

        {/* Card 3: Passwords Needing Attention */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('health')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Needing Attention</span>
            <Activity size={14} color={passwordsNeedingAttention > 0 ? 'var(--warning)' : 'var(--success)'} />
          </div>
          <div className="metric-card-value" style={{ color: passwordsNeedingAttention > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {passwordsNeedingAttention}
          </div>
          <div className="metric-card-footer">
            <span>{health.weakCount} weak • {health.reusedCount} reused</span>
          </div>
        </div>

        {/* Card 4: Shared Credentials */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('shared')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Shared Credentials</span>
            <Share2 size={14} color="#c084fc" />
          </div>
          <div className="metric-card-value">{sharing.total}</div>
          <div className="metric-card-footer">
            <span style={{ color: sharing.pending > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {sharing.pending > 0 ? `${sharing.pending} Pending` : 'All Active'}
            </span>
          </div>
        </div>

        {/* Card 5: Recent Activity */}
        <div
          className="metric-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigateTab('audit')}
        >
          <div className="metric-card-header">
            <span className="metric-card-label">Recent Activity</span>
            <FileSpreadsheet size={14} color="var(--warning)" />
          </div>
          <div className="metric-card-value">{audit.totalEvents}</div>
          <div className="metric-card-footer">
            <span>Recorded Events</span>
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid-2">
        {/* Chart 1: Password Security Breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <ShieldCheck size={16} color="var(--success)" />
              <h3 className="card-title">Password Security</h3>
            </div>
            <button
              onClick={() => onNavigateTab('health')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.74rem' }}
            >
              View Details <ArrowRight size={12} />
            </button>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            {passwordsNeedingAttention > 0
              ? 'Some saved passwords may need to be updated.'
              : 'All evaluated passwords meet recommended security standards.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Good ({health.healthy})</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {credentials.total > 0 ? Math.round((health.healthy / credentials.total) * 100) : 100}%
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${credentials.total > 0 ? Math.min(100, Math.round((health.healthy / credentials.total) * 100)) : 100}%`,
                    background: 'var(--success)',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Needs Attention ({health.needsAttention})</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {credentials.total > 0 ? Math.round((health.needsAttention / credentials.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${credentials.total > 0 ? Math.min(100, Math.round((health.needsAttention / credentials.total) * 100)) : 0}%`,
                    background: 'var(--warning)',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Weak Passwords ({health.weakCount})</span>
                <span style={{ color: 'var(--text-muted)' }}>{health.weakCount} credentials</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${credentials.total > 0 ? Math.min(100, Math.round((health.weakCount / credentials.total) * 100)) : 0}%`,
                    background: 'var(--danger)',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#fb923c', fontWeight: 600 }}>Reused Passwords ({health.reusedCount})</span>
                <span style={{ color: 'var(--text-muted)' }}>{health.reusedCount} duplicates</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${credentials.total > 0 ? Math.min(100, Math.round((health.reusedCount / credentials.total) * 100)) : 0}%`,
                    background: '#fb923c',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Credentials by Category */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <KeyRound size={16} color="var(--info)" />
              <h3 className="card-title">Credentials by Category</h3>
            </div>
            <button
              onClick={() => onNavigateTab('vault')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.74rem' }}
            >
              My Credentials <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {[
              { label: 'Work', count: credentials.byCategory.WORK || 0, color: 'var(--primary)' },
              { label: 'Development', count: credentials.byCategory.DEVELOPMENT || 0, color: 'var(--purple)' },
              { label: 'Finance', count: credentials.byCategory.FINANCE || 0, color: 'var(--success)' },
              { label: 'Social', count: credentials.byCategory.SOCIAL || 0, color: '#ec4899' },
              { label: 'Other', count: credentials.byCategory.OTHER || 0, color: 'var(--neutral)' },
            ].map((cat) => {
              const pct = credentials.total > 0 ? Math.round((cat.count / credentials.total) * 100) : 0;
              return (
                <div key={cat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cat.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {cat.count} items ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <FileSpreadsheet size={16} color="var(--warning)" />
            <h3 className="card-title">Activity Timeline</h3>
          </div>
          <button
            onClick={() => onNavigateTab('audit')}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.74rem' }}
          >
            Activity <ArrowRight size={12} />
          </button>
        </div>

        {audit.eventTimeline.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No activity recorded for the selected date range.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.45rem', height: '100px', padding: '0.25rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
            {audit.eventTimeline.map((day) => {
              const maxCount = Math.max(...audit.eventTimeline.map((d) => d.count), 1);
              const heightPct = Math.max(10, Math.round((day.count / maxCount) * 100));
              return (
                <div
                  key={day.date}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${day.date}: ${day.count} activities`}
                >
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{day.count}</div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '24px',
                      height: `${heightPct}%`,
                      background: day.failureCount > 0 ? 'var(--danger)' : 'var(--primary)',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {day.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Employee Overview Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.15rem', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-title-group">
            <Users size={16} color="var(--purple)" />
            <h3 className="card-title">Employee Overview</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigateTab('employees')}
          >
            Manage Employees ({employeeOverview.length}) <ArrowRight size={12} />
          </button>
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee Name & Email</th>
                <th>Department</th>
                <th style={{ textAlign: 'center' }}>Credentials</th>
                <th style={{ textAlign: 'center' }}>Password Health</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {employeeOverview.slice(0, 6).map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ID: {emp.employeeId} • {emp.email}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.department || 'Faculty'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--info)' }}>
                    {emp.credentialCount}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`badge ${
                        emp.healthStatus === 'HEALTHY'
                          ? 'badge-success'
                          : emp.healthStatus === 'NEEDS_ATTENTION'
                            ? 'badge-warning'
                            : 'badge-danger'
                      }`}
                    >
                      {emp.healthStatus === 'HEALTHY' ? 'Good' : emp.healthStatus === 'NEEDS_ATTENTION' ? 'Needs Attention' : 'At Risk'} ({emp.healthScore}%)
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${emp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {emp.status === 'ACTIVE' ? 'Active' : emp.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {formatTimeAgo(emp.lastActiveAt || emp.createdAt || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <Clock size={16} color="var(--info)" />
            <h3 className="card-title">Recent Activity</h3>
          </div>
          <button
            onClick={() => onNavigateTab('audit')}
            className="btn btn-ghost btn-sm"
          >
            All Activity <ArrowRight size={12} />
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No recent activity to display.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {recentActivity.slice(0, 6).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span
                    className={`badge ${item.category === 'SECURITY' ? 'badge-danger' : 'badge-info'}`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {item.category === 'AUTHENTICATION'
                      ? 'Sign In'
                      : item.category === 'CREDENTIAL'
                        ? 'Credential'
                        : item.category === 'SHARING'
                          ? 'Sharing'
                          : item.category === 'USER_MANAGEMENT'
                            ? 'Employee'
                            : 'General'}
                  </span>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.actorName}</span>
                    <span style={{ color: 'var(--text-secondary)' }}> — {formatActionDescription(item.action, item.actionDescription)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: item.result === 'SUCCESS' ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 600,
                    }}
                  >
                    {item.result === 'SUCCESS' ? 'Completed' : 'Failed'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
