import React, { useState, useEffect } from 'react';
import {
  PasswordRequestListItem,
  PasswordRequestStatus,
  PasswordRequestType,
} from '@credential-manager/types';
import {
  fetchAdminPasswordRequests,
  approveAdminPasswordRequest,
  rejectAdminPasswordRequest,
} from '../../services/password-request.api.js';
import {
  KeyRound,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  X,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface AdminPasswordRequestsViewProps {
  onPendingCountChange?: (count: number) => void;
}

export const AdminPasswordRequestsView: React.FC<AdminPasswordRequestsViewProps> = ({
  onPendingCountChange,
}) => {
  const [requests, setRequests] = useState<PasswordRequestListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal States
  const [detailItem, setDetailItem] = useState<PasswordRequestListItem | null>(null);
  const [approveItem, setApproveItem] = useState<PasswordRequestListItem | null>(null);
  const [rejectItem, setRejectItem] = useState<PasswordRequestListItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminPasswordRequests({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as PasswordRequestStatus),
        requestType: typeFilter === 'ALL' ? undefined : (typeFilter as PasswordRequestType),
        search: searchTerm.trim() || undefined,
      });

      setRequests(result.requests || []);
      setTotal(result.total || 0);
      setPendingCount(result.pendingCount || 0);
      setApprovedCount(result.approvedCount || 0);
      setRejectedCount(result.rejectedCount || 0);

      if (onPendingCountChange) {
        onPendingCountChange(result.pendingCount);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load password requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleConfirmApprove = async () => {
    if (!approveItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await approveAdminPasswordRequest(approveItem.id);
      setActionSuccess(res.message || `Password request for ${approveItem.name} approved.`);
      setApproveItem(null);
      if (detailItem?.id === approveItem.id) setDetailItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve password request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await rejectAdminPasswordRequest(rejectItem.id, rejectionReason);
      setActionSuccess(res.message || `Password request for ${rejectItem.name} rejected.`);
      setRejectItem(null);
      setRejectionReason('');
      if (detailItem?.id === rejectItem.id) setDetailItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject password request.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: PasswordRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="badge badge-warning">
            <span className="pulse-dot" />
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={11} />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-danger">
            <XCircle size={11} />
            Rejected
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const renderTypeBadge = (type: PasswordRequestType) => {
    if (type === 'FORGOT_PASSWORD') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#eab308',
            border: '1px solid rgba(234, 179, 8, 0.3)',
          }}
        >
          <Lock size={10} />
          Forgot Password
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.2rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 600,
          background: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--primary, #6366f1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <KeyRound size={10} />
        Profile Change
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header & Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Pending Requests */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid #facc15' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Pending Review
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15', marginTop: '0.15rem' }}>
                {pendingCount}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(250, 204, 21, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
              <Clock size={18} />
            </div>
          </div>
        </div>

        {/* Approved Requests */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--success, #10b981)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Approved
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success, #10b981)', marginTop: '0.15rem' }}>
                {approvedCount}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success, #10b981)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        {/* Rejected Requests */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--danger, #ef4444)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Rejected
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger, #ef4444)', marginTop: '0.15rem' }}>
                {rejectedCount}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger, #ef4444)' }}>
              <XCircle size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Success and Error Alerts */}
      {actionSuccess && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: '#10b981',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.15rem', color: '#10b981' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'var(--danger-bg, rgba(239, 68, 68, 0.1))',
            border: '1px solid var(--danger-border, rgba(239, 68, 68, 0.3))',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: '#fca5a5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.15rem', color: '#fca5a5' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. Toolbar & Filters */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, ID..."
              className="input"
              style={{ paddingLeft: '2.1rem', fontSize: '0.8rem', height: '34px' }}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '34px' }}>
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', fontSize: '0.8rem', height: '34px', padding: '0 0.75rem' }}
          >
            <option value="ALL">All Statuses ({total})</option>
            <option value="PENDING">Pending Approval ({pendingCount})</option>
            <option value="APPROVED">Approved ({approvedCount})</option>
            <option value="REJECTED">Rejected ({rejectedCount})</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', fontSize: '0.8rem', height: '34px', padding: '0 0.75rem' }}
          >
            <option value="ALL">All Types</option>
            <option value="FORGOT_PASSWORD">Forgot Password (Login)</option>
            <option value="PASSWORD_CHANGE">Password Change (Settings)</option>
          </select>

          <button
            onClick={loadData}
            className="btn btn-secondary btn-sm"
            title="Refresh list"
            disabled={loading}
            style={{ height: '34px', padding: '0 0.65rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4. Requests Table Container with Internal Scroll */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Employee / Requester</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Employee ID</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Reason / Note</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Requested At</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RotateCw size={20} className="spin" />
                      <span>Loading password requests...</span>
                    </div>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <KeyRound size={28} style={{ opacity: 0.4 }} />
                      <span style={{ fontWeight: 500 }}>No password requests found matching your filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-default)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.email}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <code style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.employeeId}</code>
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                      {renderTypeBadge(item.requestType)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.reason}>
                      {item.reason || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(item.requestedAt)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(item.status)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailItem(item)}
                          title="View Request Details"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                        >
                          <Eye size={12} />
                          View
                        </button>

                        {item.status === 'PENDING' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setApproveItem(item)}
                              title="Approve Password Request"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', background: 'var(--success, #10b981)', borderColor: 'var(--success, #10b981)' }}
                            >
                              <CheckCircle2 size={12} />
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setRejectItem(item);
                                setRejectionReason('');
                              }}
                              title="Reject Password Request"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', color: 'var(--danger, #ef4444)' }}
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: View Request Details */}
      {detailItem && (
        <div className="modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={16} color="var(--primary, #6366f1)" />
                <h3 className="modal-title">Password Request Details</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailItem(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requester Name</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>{detailItem.name}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered Email</span>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>{detailItem.email}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Employee ID</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>{detailItem.employeeId}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Request Type</span>
                  <div style={{ marginTop: '3px' }}>{renderTypeBadge(detailItem.requestType)}</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Requester Reason / Note</span>
                <div style={{ color: 'var(--text-secondary)' }}>{detailItem.reason || 'No specific note provided.'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requested On</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{formatDate(detailItem.requestedAt)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Status</span>
                  <div style={{ marginTop: '2px' }}>{renderStatusBadge(detailItem.status)}</div>
                </div>
              </div>

              {detailItem.status !== 'PENDING' && (
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.78rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Reviewed by: </span><strong>{detailItem.reviewedByName || detailItem.reviewedBy || 'Admin'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Reviewed on: </span>{formatDate(detailItem.reviewedAt)}</div>
                  {detailItem.adminNote && (
                    <div style={{ marginTop: '4px' }}><span style={{ color: 'var(--text-muted)' }}>Review Note: </span>{detailItem.adminNote}</div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setDetailItem(null)}>
                Close
              </button>
              {detailItem.status === 'PENDING' && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setRejectItem(item);
                      setRejectionReason('');
                    }}
                    style={{ color: 'var(--danger, #ef4444)' }}
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setApproveItem(item);
                    }}
                    style={{ background: 'var(--success, #10b981)', borderColor: 'var(--success, #10b981)' }}
                  >
                    <CheckCircle2 size={13} />
                    Approve Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Approve Password Request Confirmation */}
      {approveItem && (
        <div className="modal-overlay" onClick={() => setApproveItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success, #10b981)" />
                <h3 className="modal-title" style={{ color: 'var(--success, #10b981)' }}>Approve Password Request</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setApproveItem(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to approve the password update for <strong>{approveItem.name}</strong> ({approveItem.email})?
              </p>
              <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Request Type: </span><strong>{approveItem.requestType === 'FORGOT_PASSWORD' ? 'Forgot Password Reset' : 'Account Settings Change'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Impact: </span><span style={{ color: '#10b981' }}>New password hash will be activated immediately and a confirmation email will be dispatched.</span></div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setApproveItem(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
                style={{ background: 'var(--success, #10b981)', borderColor: 'var(--success, #10b981)' }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                Approve & Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Reject Password Request Confirmation */}
      {rejectItem && (
        <div className="modal-overlay" onClick={() => setRejectItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={16} color="var(--danger, #ef4444)" />
                <h3 className="modal-title" style={{ color: 'var(--danger, #ef4444)' }}>Reject Password Request</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setRejectItem(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to reject the password request for <strong>{rejectItem.name}</strong> ({rejectItem.email})?
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Reason (Optional note for employee)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Identity verification pending or invalid request"
                  className="input"
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectItem(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                style={{ background: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <XCircle size={13} />}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
