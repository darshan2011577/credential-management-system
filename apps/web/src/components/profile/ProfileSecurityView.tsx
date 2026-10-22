import React, { useState } from 'react';
import { useAuth } from '../../auth/auth.context.js';
import { ChangePasswordModal } from '../ChangePasswordModal.js';
import {
  User,
  Shield,
  Lock,
  Building,
  Mail,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

export const ProfileSecurityView: React.FC = () => {
  const { user } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1000px' }}>
      {/* Profile Overview Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <User size={18} color="var(--primary)" />
            <h3 className="card-title">Account Profile</h3>
          </div>
          <span className={`badge ${user?.role === 'ADMIN' ? 'badge-purple' : 'badge-info'}`}>
            {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Full Name
            </span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.name || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Employee ID
            </span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {user?.employeeId || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Email Address
            </span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={13} />
              {user?.email || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Department
            </span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building size={13} />
              {user?.department || 'Information Technology'}
            </div>
          </div>
        </div>
      </div>

      {/* Security & Password Management */}
      <div className="grid-2">
        {/* Card 1: Password & Sign-in */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Lock size={18} color="var(--warning)" />
              <h3 className="card-title">Password & Sign-in</h3>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
            Keep your account secure by using a strong password and changing it whenever necessary.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Account Status</span>
              <span className="badge badge-success">Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sign-in Protection</span>
              <span className="badge badge-info">Protected</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Session Security</span>
              <span className="badge badge-success">Secure Session</span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowPasswordModal(true)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <KeyRound size={14} />
            Change Password
          </button>
        </div>

        {/* Card 2: Protection & Privacy */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Shield size={18} color="var(--success)" />
              <h3 className="card-title">Security & Protection</h3>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
            All saved passwords and account data are guarded with industry-standard encryption and access controls.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Data Protection</span>
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={11} />
                Encrypted Vault
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Access Control</span>
              <span className="badge badge-info">Role Based</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Activity Monitoring</span>
              <span className="badge badge-success">Enabled</span>
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
