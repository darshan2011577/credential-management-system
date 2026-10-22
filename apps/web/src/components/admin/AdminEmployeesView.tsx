import React, { useState, useEffect, useMemo } from 'react';
import { fetchAdminDashboardStats } from '../../services/admin-dashboard.api.js';
import {
  suspendEmployee,
  reactivateEmployee,
  deleteEmployee,
} from '../../services/admin-registration.api.js';
import { AdminDashboardEmployeeOverviewItem } from '@credential-manager/types';
import { AdminRegistrationsView } from './AdminRegistrationsView.js';
import { AdminPasswordRequestsView } from './AdminPasswordRequestsView.js';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
  UserCheck,
  Ban,
  CheckCircle2,
  Trash2,
  RotateCw,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

interface AdminEmployeesViewProps {
  onFilterEmployeeLogs?: (employeeId: string) => void;
}

export const AdminEmployeesView: React.FC<AdminEmployeesViewProps> = ({
  onFilterEmployeeLogs,
}) => {
  const [subTab, setSubTab] = useState<'directory' | 'registrations' | 'password-requests'>('directory');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingPasswordCount, setPendingPasswordCount] = useState<number>(0);
  const [employees, setEmployees] = useState<AdminDashboardEmployeeOverviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modal Targets
  const [selectedEmployee, setSelectedEmployee] = useState<AdminDashboardEmployeeOverviewItem | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminDashboardEmployeeOverviewItem | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AdminDashboardEmployeeOverviewItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDashboardEmployeeOverviewItem | null>(null);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await fetchAdminDashboardStats({});
      setEmployees(stats.employeeOverview || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      await suspendEmployee(suspendTarget.id);
      setActionSuccess(`Account for ${suspendTarget.name} has been suspended.`);
      setSuspendTarget(null);
      if (selectedEmployee?.id === suspendTarget.id) setSelectedEmployee(null);
      await loadEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to suspend account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      await reactivateEmployee(reactivateTarget.id);
      setActionSuccess(`Account for ${reactivateTarget.name} has been reactivated.`);
      setReactivateTarget(null);
      if (selectedEmployee?.id === reactivateTarget.id) setSelectedEmployee(null);
      await loadEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteEmployee(deleteTarget.id);
      setActionSuccess(`Employee profile for ${deleteTarget.name} was permanently deleted.`);
      setDeleteTarget(null);
      if (selectedEmployee?.id === deleteTarget.id) setSelectedEmployee(null);
      await loadEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        !searchTerm ||
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || emp.status === statusFilter;
      const matchDept = departmentFilter === 'ALL' || emp.department === departmentFilter;

      return matchSearch && matchStatus && matchDept;
    });
  }, [employees, searchTerm, statusFilter, departmentFilter]);

  const formatTimeAgo = (isoString?: string): string => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className={`btn btn-sm ${subTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('directory')}
          style={{ fontSize: '0.82rem' }}
        >
          <Users size={13} />
          All Employees ({employees.length})
        </button>

        <button
          className={`btn btn-sm ${subTab === 'registrations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('registrations')}
          style={{ fontSize: '0.82rem' }}
        >
          <UserCheck size={13} />
          Pending Registrations
          {pendingCount > 0 && (
            <span
              style={{
                marginLeft: '0.35rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'var(--danger, #ef4444)',
                color: '#ffffff',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          className={`btn btn-sm ${subTab === 'password-requests' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('password-requests')}
          style={{ fontSize: '0.82rem' }}
        >
          <KeyRound size={13} />
          Password Requests
          {pendingPasswordCount > 0 && (
            <span
              style={{
                marginLeft: '0.35rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: '#eab308',
                color: '#000000',
              }}
            >
              {pendingPasswordCount}
            </span>
          )}
        </button>
      </div>

      {subTab === 'registrations' ? (
        <AdminRegistrationsView onPendingCountChange={(cnt) => setPendingCount(cnt)} />
      ) : subTab === 'password-requests' ? (
        <AdminPasswordRequestsView onPendingCountChange={(cnt) => setPendingPasswordCount(cnt)} />
      ) : (
        <>
          {/* Action Success Alert */}
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

          {/* Action Error Alert */}
          {error && (
            <div
              style={{
                background: 'var(--danger-bg, rgba(239, 68, 68, 0.15))',
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
                    background: 'var(--purple-bg)',
                    color: 'var(--purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--purple-border)',
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Employee Directory
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Manage employee accounts, security status, and account actions.
                  </p>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={loadEmployees}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Filter Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 1fr',
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
                <option value="ACTIVE">Active</option>
                <option value="APPROVED">Approved</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DISABLED">Disabled</option>
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
            </div>
          </div>

          {/* Table Container with Internal Scroll */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={18} className="spin" />
                  <span>Loading employees...</span>
                </div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <AlertTriangle size={24} color="var(--warning)" style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  No employees matched the filter
                </div>
                <p style={{ fontSize: '0.82rem' }}>Try clearing the search query or status filter.</p>
              </div>
            ) : (
              <div
                className="table-wrapper"
                style={{
                  border: 'none',
                  borderRadius: 0,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <table className="data-table" style={{ width: '100%', minWidth: '920px' }}>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>Employee Name & Email</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Department</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Saved Credentials</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Password Health</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Last Active</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              ID: {emp.employeeId} • {emp.email}
                            </span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {emp.department || 'General'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className="badge badge-info">
                            {emp.credentialCount} saved
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            className={`badge ${
                              emp.status === 'ACTIVE'
                                ? 'badge-success'
                                : emp.status === 'SUSPENDED'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                            }`}
                          >
                            {emp.status === 'ACTIVE' ? 'Active' : emp.status === 'SUSPENDED' ? 'Suspended' : emp.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatTimeAgo(emp.lastActiveAt)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {/* View Details */}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedEmployee(emp)}
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                              title="View Details"
                            >
                              <Eye size={12} />
                              Details
                            </button>

                            {/* Suspend / Reactivate */}
                            {emp.status === 'ACTIVE' || emp.status === 'APPROVED' ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSuspendTarget(emp)}
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: '#facc15' }}
                                title="Suspend Account"
                              >
                                <Ban size={12} />
                                Suspend
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setReactivateTarget(emp)}
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: 'var(--success, #22c55e)' }}
                                title="Reactivate Account"
                              >
                                <CheckCircle2 size={12} />
                                Activate
                              </button>
                            )}

                            {/* Delete Profile */}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setDeleteTarget(emp)}
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: 'var(--danger, #ef4444)' }}
                              title="Delete Profile Permanently"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 1. Modal: Employee Details Popup */}
          {selectedEmployee && (
            <div className="modal-overlay" onClick={() => setSelectedEmployee(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={16} color="var(--purple)" />
                    <h3 className="modal-title">Employee Details</h3>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedEmployee(null)}
                    style={{ padding: '0.2rem' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body">
                  {/* Account Information */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Account Information
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Full Name</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>{selectedEmployee.name}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Employee ID</span>
                        <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{selectedEmployee.employeeId}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email Address</span>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmployee.email}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Department</span>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmployee.department || 'General'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Security & Health Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Security & Health Status
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Account Status</span>
                        <div style={{ marginTop: '3px' }}>
                          <span className={`badge ${selectedEmployee.status === 'ACTIVE' ? 'badge-success' : selectedEmployee.status === 'SUSPENDED' ? 'badge-danger' : 'badge-warning'}`}>
                            {selectedEmployee.status === 'ACTIVE' ? 'Active' : selectedEmployee.status === 'SUSPENDED' ? 'Suspended' : selectedEmployee.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Password Health</span>
                        <div style={{ marginTop: '3px' }}>
                          <span
                            className={`badge ${
                              selectedEmployee.healthStatus === 'HEALTHY'
                                ? 'badge-success'
                                : selectedEmployee.healthStatus === 'NEEDS_ATTENTION'
                                  ? 'badge-warning'
                                  : 'badge-danger'
                            }`}
                          >
                            {selectedEmployee.healthStatus === 'HEALTHY' ? 'Good' : selectedEmployee.healthStatus === 'NEEDS_ATTENTION' ? 'Needs Attention' : 'At Risk'} ({selectedEmployee.healthScore}%)
                          </span>
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saved Credentials</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                          {selectedEmployee.credentialCount} credentials
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Last Active</span>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {formatTimeAgo(selectedEmployee.lastActiveAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  {onFilterEmployeeLogs && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onFilterEmployeeLogs(selectedEmployee.employeeId);
                        setSelectedEmployee(null);
                      }}
                    >
                      View Activity
                    </button>
                  )}

                  {selectedEmployee.status === 'ACTIVE' || selectedEmployee.status === 'APPROVED' ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSuspendTarget(selectedEmployee)}
                      style={{ color: '#facc15' }}
                    >
                      <Ban size={13} />
                      Suspend Account
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReactivateTarget(selectedEmployee)}
                      style={{ color: 'var(--success, #22c55e)' }}
                    >
                      <CheckCircle2 size={13} />
                      Reactivate Account
                    </button>
                  )}

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDeleteTarget(selectedEmployee)}
                    style={{ color: 'var(--danger, #ef4444)' }}
                  >
                    <Trash2 size={13} />
                    Delete Profile
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedEmployee(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Modal: Suspend Account Confirmation Popup */}
          {suspendTarget && (
            <div className="modal-overlay" onClick={() => setSuspendTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Ban size={16} color="#facc15" />
                    <h3 className="modal-title" style={{ color: '#facc15' }}>Suspend Account</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSuspendTarget(null)} disabled={actionLoading}>
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body">
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Are you sure you want to suspend the account for <strong>{suspendTarget.name}</strong> ({suspendTarget.email})?
                  </p>
                  <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Employee ID: </span><code style={{ fontFamily: 'monospace' }}>{suspendTarget.employeeId}</code></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Impact: </span><span style={{ color: '#facc15' }}>User will be immediately locked out and blocked from signing in.</span></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setSuspendTarget(null)} disabled={actionLoading}>
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

          {/* 3. Modal: Reactivate Account Confirmation Popup */}
          {reactivateTarget && (
            <div className="modal-overlay" onClick={() => setReactivateTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} color="var(--success, #22c55e)" />
                    <h3 className="modal-title" style={{ color: 'var(--success, #22c55e)' }}>Reactivate Account</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReactivateTarget(null)} disabled={actionLoading}>
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body">
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Are you sure you want to reactivate the account for <strong>{reactivateTarget.name}</strong> ({reactivateTarget.email})?
                  </p>
                  <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status will be restored to </span>
                    <strong style={{ color: 'var(--success, #22c55e)' }}>ACTIVE</strong>.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setReactivateTarget(null)} disabled={actionLoading}>
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

          {/* 4. Modal: Delete Profile Permanently Confirmation Popup */}
          {deleteTarget && (
            <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} color="var(--danger, #ef4444)" />
                    <h3 className="modal-title" style={{ color: 'var(--danger, #ef4444)' }}>Delete Employee Profile</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)} disabled={actionLoading}>
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body">
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Are you sure you want to permanently delete the profile for <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
                  </p>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#fca5a5', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <strong>Warning: This action cannot be undone.</strong>
                    <span>All employee profile information, personal credentials, shared items, and in-app notifications will be permanently removed.</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)} disabled={actionLoading}>
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
        </>
      )}
    </div>
  );
};
