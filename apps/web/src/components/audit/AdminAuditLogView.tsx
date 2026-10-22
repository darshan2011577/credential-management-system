import React, { useState, useEffect, useCallback } from 'react';
import {
  IAuditLog,
  AuditCategory,
  AuditResult,
  AuditLogQuery,
} from '@credential-manager/types';
import { AUDIT_CONFIG } from '@credential-manager/config';
import { fetchAuditLogs } from '../../services/audit-log.api.js';
import {
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Activity,
} from 'lucide-react';

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
    REGISTRATION_SUBMITTED: 'Registration submitted',
    REGISTRATION_APPROVED: 'Employee registration approved',
    REGISTRATION_REJECTED: 'Employee registration rejected',
    CREDENTIALS_SENT: 'Login credentials sent',
    CREDENTIALS_RESENT: 'Login credentials resend requested',
    LOGIN_BLOCKED_PENDING: 'Sign-in blocked (approval pending)',
    LOGIN_BLOCKED_REJECTED: 'Sign-in blocked (registration rejected)',
    LOGIN_BLOCKED_DISABLED: 'Sign-in blocked (account disabled)',
  };

  if (map[action]) return map[action];
  if (description && !description.includes('_')) return description;
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const AdminAuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Inspector Modal
  const [selectedLog, setSelectedLog] = useState<IAuditLog | null>(null);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: AuditLogQuery = {
        page: currentPage,
        limit,
        category: selectedCategory !== 'ALL' ? (selectedCategory as AuditCategory) : undefined,
        result: selectedResult !== 'ALL' ? (selectedResult as AuditResult) : undefined,
        search: searchQuery.trim() || undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
      };

      const res = await fetchAuditLogs(query);
      setLogs(res.items || []);
      setTotalLogs(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve audit events.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, selectedCategory, selectedResult, searchQuery, fromDate, toDate]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleClearFilters = () => {
    setSelectedCategory('ALL');
    setSelectedResult('ALL');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const getResultBadge = (result: AuditResult) => {
    switch (result) {
      case 'SUCCESS':
        return <span className="badge badge-success">SUCCESS</span>;
      case 'FAILURE':
        return <span className="badge badge-danger">FAILURE</span>;
      case 'DENIED':
        return <span className="badge badge-warning">DENIED</span>;
      default:
        return <span className="badge badge-neutral">{result}</span>;
    }
  };

  const getCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case 'AUTHENTICATION':
        return <span className="badge badge-info">AUTH</span>;
      case 'CREDENTIAL':
        return <span className="badge badge-info">CREDENTIAL</span>;
      case 'SHARING':
        return <span className="badge badge-purple">SHARING</span>;
      case 'PASSWORD_HEALTH':
        return <span className="badge badge-warning">HEALTH</span>;
      case 'SECURITY':
        return <span className="badge badge-danger">SECURITY</span>;
      case 'SYSTEM':
        return <span className="badge badge-neutral">SYSTEM</span>;
      default:
        return <span className="badge badge-neutral">{category}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Console Control & Filter Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          padding: '1.15rem 1.35rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--warning-bg)',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--warning-border)',
              }}
            >
              <Activity size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Activity History
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Review recent account and security activity across the organization.
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadAuditLogs}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr auto auto',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          {/* Search Query */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.7rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search action, actor, IP, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.1rem', fontSize: '0.82rem' }}
            />
          </div>

          {/* Category Filter */}
          <select
            className="select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem' }}
          >
            <option value="ALL">All Categories</option>
            {AUDIT_CONFIG.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Result Filter */}
          <select
            className="select"
            value={selectedResult}
            onChange={(e) => {
              setSelectedResult(e.target.value);
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem' }}
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>

          {/* Limit select */}
          <select
            className="select"
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem', width: 'auto' }}
          >
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>

          {(selectedCategory !== 'ALL' || selectedResult !== 'ALL' || searchQuery || fromDate || toDate) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearFilters}
              style={{ fontSize: '0.78rem' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.85rem',
            color: '#fca5a5',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem' }} />
            <div>Loading activity history...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No Activity Recorded
            </div>
            <p style={{ fontSize: '0.82rem' }}>No activity records matched the selected filter criteria.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>User</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>IP Address</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>{getCategoryBadge(log.category)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                          {formatActionDescription(log.action, (log.metadata as any)?.description || (log.metadata as any)?.title)}
                        </span>
                        {(log.metadata as any)?.title && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {(log.metadata as any).title}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>{log.actorEmail}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {log.actorRole}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{getResultBadge(log.result)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLog(log)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        <Eye size={12} />
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

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1rem',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalLogs} events)
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} color="var(--warning)" />
                <h3 className="modal-title">Activity Details</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLog(null)} style={{ padding: '0.2rem' }}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Event Attributes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    {formatActionDescription(selectedLog.action)}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                  <div>{getResultBadge(selectedLog.result)}</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</span>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{selectedLog.actorEmail} ({selectedLog.actorRole})</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</span>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Sanitized Metadata JSON Payload */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                    Event Details
                  </span>
                  <pre
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      overflowX: 'auto',
                      maxHeight: '180px',
                    }}
                  >
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
