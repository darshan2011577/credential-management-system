import React, { useState, useEffect, useMemo } from 'react';
import {
  RegistrationListItem,
  UserStatus,
  CredentialDeliveryStatus,
} from '@credential-manager/types';
import {
  fetchRegistrations,
  approveRegistration,
  rejectRegistration,
  sendLoginCredentials,
  resendLoginCredentials,
  suspendEmployee,
  reactivateEmployee,
  deleteEmployee,
} from '../../services/admin-registration.api.js';
import {
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Mail,
  RotateCw,
  X,
  AlertCircle,
  User,
  Send,
  Ban,
  Trash2,
} from 'lucide-react';

interface AdminRegistrationsViewProps {
  onPendingCountChange?: (count: number) => void;
}

export const AdminRegistrationsView: React.FC<AdminRegistrationsViewProps> = ({
  onPendingCountChange,
}) => {
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modal States
  const [detailItem, setDetailItem] = useState<RegistrationListItem | null>(null);
  const [approveItem, setApproveItem] = useState<RegistrationListItem | null>(null);
  const [rejectItem, setRejectItem] = useState<RegistrationListItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [sendCredsItem, setSendCredsItem] = useState<RegistrationListItem | null>(null);
  const [resendCredsItem, setResendCredsItem] = useState<RegistrationListItem | null>(null);
  const [suspendItem, setSuspendItem] = useState<RegistrationListItem | null>(null);
  const [reactivateItem, setReactivateItem] = useState<RegistrationListItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<RegistrationListItem | null>(null);

  // Processing state
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRegistrations({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as UserStatus),
        department: departmentFilter === 'ALL' ? undefined : departmentFilter,
        search: searchTerm.trim() || undefined,
      });
      setRegistrations(result.registrations || []);
      if (onPendingCountChange) {
        onPendingCountChange(result.pendingCount);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registration requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, departmentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const departments = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [registrations]);

  // Handle Approve
  const handleConfirmApprove = async () => {
    if (!approveItem) return;
    setActionLoading(true);
    setError(null);
    try {
      await approveRegistration(approveItem.id);
      setActionSuccess(`Registration for ${approveItem.name} has been approved.`);
      setApproveItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve registration.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    setActionLoading(true);
    setError(null);
    try {
      await rejectRegistration(rejectItem.id, rejectionReason);
      setActionSuccess(`Registration for ${rejectItem.name} has been rejected.`);
      setRejectItem(null);
      setRejectionReason('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject registration.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Send Credentials
  const handleConfirmSendCredentials = async () => {
    if (!sendCredsItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await sendLoginCredentials(sendCredsItem.id);
      if (result.success) {
        setActionSuccess(`Login credentials sent successfully to ${sendCredsItem.email}.`);
      } else {
        setError(result.message || 'Could not send login credentials. Please try again.');
      }
      setSendCredsItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send credentials.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Resend Credentials
  const handleConfirmResendCredentials = async () => {
    if (!resendCredsItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await resendLoginCredentials(resendCredsItem.id);
      if (result.success) {
        setActionSuccess(`New login credentials generated and sent to ${resendCredsItem.email}.`);
      } else {
        setError(result.message || 'Could not resend login credentials. Please try again.');
      }
      setResendCredsItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend credentials.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Suspend
  const handleConfirmSuspend = async () => {
    if (!suspendItem) return;
    setActionLoading(true);
    setError(null);
    try {
      await suspendEmployee(suspendItem.id);
      setActionSuccess(`Account for ${suspendItem.name} has been suspended.`);
      setSuspendItem(null);
      if (detailItem?.id === suspendItem.id) setDetailItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to suspend account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reactivate
  const handleConfirmReactivate = async () => {
    if (!reactivateItem) return;
    setActionLoading(true);
    setError(null);
    try {
      await reactivateEmployee(reactivateItem.id);
      setActionSuccess(`Account for ${reactivateItem.name} has been reactivated.`);
      setReactivateItem(null);
      if (detailItem?.id === reactivateItem.id) setDetailItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Profile
  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteEmployee(deleteItem.id);
      setActionSuccess(`Employee registration and profile for ${deleteItem.name} have been permanently removed.`);
      setDeleteItem(null);
      if (detailItem?.id === deleteItem.id) setDetailItem(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: UserStatus, delivery?: CredentialDeliveryStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="badge badge-warning">
            <span className="pulse-dot" />
            Pending
          </span>
        );
      case 'APPROVED':
        if (delivery === 'SENT') {
          return (
            <span className="badge badge-info">
              <CheckCircle2 size={11} />
              Credentials Sent
            </span>
          );
        }
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={11} />
            Approved
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={11} />
            Active
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-danger">
            <XCircle size={11} />
            Rejected
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <Ban size={11} />
            Suspended
          </span>
        );
      case 'DISABLED':
      case 'INACTIVE':
        return (
          <span className="badge badge-neutral">
            Disabled
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const renderDeliveryBadge = (delivery?: CredentialDeliveryStatus) => {
    switch (delivery) {
      case 'SENT':
        return (
          <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
            <CheckCircle2 size={11} />
            Sent
          </span>
        );
      case 'SENDING':
        return (
          <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
            <RotateCw size={11} className="spin" />
            Sending...
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
            <AlertCircle size={11} />
            Failed
          </span>
        );
      default:
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Not Sent
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Alert Notices */}
      {actionSuccess && (
        <div
          style={{
            background: 'var(--success-bg, rgba(34, 197, 94, 0.15))',
            border: '1px solid var(--success-border, rgba(34, 197, 94, 0.3))',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: 'var(--success, #22c55e)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActionSuccess(null)}
            style={{ padding: '0.15rem' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
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
            className="btn btn-ghost btn-sm"
            onClick={() => setError(null)}
            style={{ padding: '0.15rem' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Control Header & Filters */}
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
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Pending Registrations
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Review new account requests and approve or reject them.
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter Row */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr 1fr auto',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative' }}>
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
              placeholder="Search by name, email, or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ paddingLeft: '2.1rem', fontSize: '0.8rem' }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
            style={{ fontSize: '0.8rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="input"
            style={{ fontSize: '0.8rem' }}
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>
      </div>

      {/* Registrations Table with Internal Horizontal Scroll */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="table-wrapper"
          style={{
            border: 'none',
            borderRadius: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table className="data-table" style={{ width: '100%', minWidth: '880px' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Employee Name</th>
                <th style={{ whiteSpace: 'nowrap' }}>Email Address</th>
                <th style={{ whiteSpace: 'nowrap' }}>Department</th>
                <th style={{ whiteSpace: 'nowrap' }}>Employee ID</th>
                <th style={{ whiteSpace: 'nowrap' }}>Registered On</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>Credentials</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <RotateCw size={18} className="spin" />
                      <span>Loading registration requests...</span>
                    </div>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No registration requests found.</p>
                  </td>
                </tr>
              ) : (
                registrations.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {item.email}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {item.department || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                      {item.employeeId}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(item.registeredAt)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {renderStatusBadge(item.status, item.credentialDeliveryStatus)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {item.status === 'PENDING' || item.status === 'REJECTED' ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        renderDeliveryBadge(item.credentialDeliveryStatus)
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        {/* View Details */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailItem(item)}
                          title="View Details"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                        >
                          <Eye size={12} />
                          View
                        </button>

                        {/* Pending Actions */}
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setApproveItem(item)}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }}
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
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', color: 'var(--danger, #ef4444)' }}
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          </>
                        )}

                        {/* Approved / Not Sent Action */}
                        {(item.status === 'APPROVED' || item.status === 'ACTIVE') &&
                          item.credentialDeliveryStatus !== 'SENT' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setSendCredsItem(item)}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }}
                            >
                              <Send size={12} />
                              Send Credentials
                            </button>
                          )}

                        {/* Approved / Sent -> Resend Action */}
                        {(item.status === 'APPROVED' || item.status === 'ACTIVE') &&
                          item.credentialDeliveryStatus === 'SENT' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setResendCredsItem(item)}
                              title="Resend login credentials"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }}
                            >
                              <Mail size={12} />
                              Resend
                            </button>
                          )}

                        {/* Suspend Action (for Active / Approved accounts) */}
                        {(item.status === 'ACTIVE' || item.status === 'APPROVED') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSuspendItem(item)}
                            title="Suspend Account"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: '#facc15' }}
                          >
                            <Ban size={12} />
                            Suspend
                          </button>
                        )}

                        {/* Reactivate Action (for Suspended accounts) */}
                        {item.status === 'SUSPENDED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setReactivateItem(item)}
                            title="Reactivate Account"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: 'var(--success, #10b981)' }}
                          >
                            <CheckCircle2 size={12} />
                            Reactivate
                          </button>
                        )}

                        {/* Delete Profile Action (for all accounts) */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDeleteItem(item)}
                          title="Delete Employee Profile"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: 'var(--danger, #ef4444)' }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: View Registration Details Popup */}
      {detailItem && (
        <div className="modal-overlay" onClick={() => setDetailItem(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} color="var(--primary, #6366f1)" />
                <h3 className="modal-title">Registration Details</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDetailItem(null)}
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Personal Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Personal Information
                </span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    background: 'var(--bg-surface)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Full Name</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                      {detailItem.name}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email Address</span>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                      {detailItem.email}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Phone Number</span>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                      {detailItem.phoneNumber || 'Not provided'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Work Information
                </span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    background: 'var(--bg-surface)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Employee ID</span>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {detailItem.employeeId}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Department</span>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                      {detailItem.department || 'General'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Registration Status
                </span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    background: 'var(--bg-surface)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Submitted On</span>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {formatDate(detailItem.registeredAt)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Status</span>
                    <div style={{ marginTop: '2px' }}>
                      {renderStatusBadge(detailItem.status, detailItem.credentialDeliveryStatus)}
                    </div>
                  </div>
                  {detailItem.approvedAt && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Approved On</span>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatDate(detailItem.approvedAt)}
                      </div>
                    </div>
                  )}
                  {detailItem.credentialsSentAt && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Credentials Delivered</span>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatDate(detailItem.credentialsSentAt)}
                      </div>
                    </div>
                  )}
                  {detailItem.rejectionReason && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rejection Reason</span>
                      <div style={{ color: 'var(--danger, #ef4444)', marginTop: '2px', fontSize: '0.82rem' }}>
                        {detailItem.rejectionReason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDetailItem(null)}
              >
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
                  >
                    <CheckCircle2 size={13} />
                    Approve Registration
                  </button>
                </>
              )}
              {(detailItem.status === 'APPROVED' || detailItem.status === 'ACTIVE') &&
                detailItem.credentialDeliveryStatus !== 'SENT' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setSendCredsItem(item);
                    }}
                  >
                    <Send size={13} />
                    Send Credentials
                  </button>
                )}
              {(detailItem.status === 'APPROVED' || detailItem.status === 'ACTIVE') &&
                detailItem.credentialDeliveryStatus === 'SENT' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setResendCredsItem(item);
                    }}
                  >
                    <Mail size={13} />
                    Resend Credentials
                  </button>
                )}
              {(detailItem.status === 'ACTIVE' || detailItem.status === 'APPROVED') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    setSuspendItem(item);
                  }}
                  style={{ color: '#facc15' }}
                >
                  <Ban size={13} />
                  Suspend Account
                </button>
              )}
              {detailItem.status === 'SUSPENDED' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    setReactivateItem(item);
                  }}
                  style={{ color: 'var(--success, #10b981)' }}
                >
                  <CheckCircle2 size={13} />
                  Reactivate Account
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const item = detailItem;
                  setDetailItem(null);
                  setDeleteItem(item);
                }}
                style={{ color: 'var(--danger, #ef4444)' }}
              >
                <Trash2 size={13} />
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Approve Registration Popup */}
      {approveItem && (
        <div className="modal-overlay" onClick={() => setApproveItem(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--primary, #6366f1)" />
                <h3 className="modal-title">Approve Registration</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setApproveItem(null)}
                disabled={actionLoading}
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to approve this account for <strong>{approveItem.name}</strong> ({approveItem.email})?
              </p>

              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Department: </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{approveItem.department || 'General'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Employee ID: </span>
                  <span style={{ fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>{approveItem.employeeId}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setApproveItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                Approve Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Reject Registration Popup */}
      {rejectItem && (
        <div className="modal-overlay" onClick={() => setRejectItem(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={16} color="var(--danger, #ef4444)" />
                <h3 className="modal-title" style={{ color: 'var(--danger, #ef4444)' }}>
                  Reject Registration
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRejectItem(null)}
                disabled={actionLoading}
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to reject the registration request for <strong>{rejectItem.name}</strong>?
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Ineligible department or duplicate entry"
                  className="input"
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setRejectItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                style={{ background: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <XCircle size={13} />}
                Reject Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Send Login Credentials Popup */}
      {sendCredsItem && (
        <div className="modal-overlay" onClick={() => setSendCredsItem(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={16} color="var(--primary, #6366f1)" />
                <h3 className="modal-title">Send Login Credentials</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSendCredsItem(null)}
                disabled={actionLoading}
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This will generate a secure temporary password and email login details to{' '}
                <strong>{sendCredsItem.name}</strong> at <strong>{sendCredsItem.email}</strong>.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSendCredsItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmSendCredentials}
                disabled={actionLoading}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <Send size={13} />}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Resend Login Credentials Popup */}
      {resendCredsItem && (
        <div className="modal-overlay" onClick={() => setResendCredsItem(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="var(--primary, #6366f1)" />
                <h3 className="modal-title">Resend Login Credentials</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setResendCredsItem(null)}
                disabled={actionLoading}
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                A new secure password will be generated, and updated login credentials will be emailed to{' '}
                <strong>{resendCredsItem.email}</strong>.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setResendCredsItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmResendCredentials}
                disabled={actionLoading}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <Mail size={13} />}
                Send New Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Suspend Account Confirmation Popup */}
      {suspendItem && (
        <div className="modal-overlay" onClick={() => setSuspendItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ban size={16} color="#facc15" />
                <h3 className="modal-title" style={{ color: '#facc15' }}>Suspend Account</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSuspendItem(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to suspend the account for <strong>{suspendItem.name}</strong> ({suspendItem.email})?
              </p>
              <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Employee ID: </span><code style={{ fontFamily: 'monospace' }}>{suspendItem.employeeId}</code></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Impact: </span><span style={{ color: '#facc15' }}>User will be immediately locked out and blocked from signing in.</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setSuspendItem(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmSuspend}
                disabled={actionLoading}
                style={{ background: '#eab308', borderColor: '#eab308', color: '#000000', fontWeight: 600 }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <Ban size={13} />}
                Suspend Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Reactivate Account Confirmation Popup */}
      {reactivateItem && (
        <div className="modal-overlay" onClick={() => setReactivateItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success, #22c55e)" />
                <h3 className="modal-title" style={{ color: 'var(--success, #22c55e)' }}>Reactivate Account</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setReactivateItem(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to reactivate the account for <strong>{reactivateItem.name}</strong> ({reactivateItem.email})?
              </p>
              <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status will be restored to </span>
                <strong style={{ color: 'var(--success, #22c55e)' }}>ACTIVE</strong>.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setReactivateItem(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmReactivate}
                disabled={actionLoading}
                style={{ background: 'var(--success, #22c55e)', borderColor: 'var(--success, #22c55e)' }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                Reactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Delete Profile Confirmation Popup */}
      {deleteItem && (
        <div className="modal-overlay" onClick={() => setDeleteItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={16} color="var(--danger, #ef4444)" />
                <h3 className="modal-title" style={{ color: 'var(--danger, #ef4444)' }}>Delete Employee Profile</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteItem(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete the profile for <strong>{deleteItem.name}</strong> ({deleteItem.email})?
              </p>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#fca5a5', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong>Warning: This action cannot be undone.</strong>
                <span>All employee profile information, personal credentials, shared items, and in-app notifications will be permanently removed.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteItem(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                style={{ background: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
              >
                {actionLoading ? <RotateCw size={13} className="spin" /> : <Trash2 size={13} />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

