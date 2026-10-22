import React, { useState, useEffect } from 'react';
import {
  submitPasswordChangeRequest,
  getMyPendingPasswordRequest,
} from '../services/password-request.api.js';
import {
  KeyRound,
  AlertCircle,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCw,
  Send,
  HelpCircle,
  Clock,
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [hasPending, setHasPending] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setReason('');
      setError(null);
      setIsSuccess(false);

      getMyPendingPasswordRequest()
        .then((res) => {
          setHasPending(res.hasPending);
          if (res.request?.requestedAt) {
            setPendingDate(new Date(res.request.requestedAt).toLocaleDateString());
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password cannot be the same as your current password.');
      return;
    }

    setLoading(true);
    try {
      const result = await submitPasswordChangeRequest({
        currentPassword,
        newPassword,
        reason: reason.trim() || undefined,
      });

      setIsSuccess(true);
      setSuccessMessage(
        result.message ||
          'Your password change request has been submitted to the administrator for review. Your current password remains active until approved.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit password change request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyRound size={17} color="var(--primary, #6366f1)" />
            </div>
            <div>
              <h3 className="modal-title">Request Password Change</h3>
              <p className="modal-subtitle">Submit a password update for administrator approval</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {isSuccess ? (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: 0, color: '#10b981', fontSize: '1rem', fontWeight: 700 }}>
                Request Submitted Successfully
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {successMessage}
              </p>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 0.9rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textAlign: 'left',
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Important:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                Your current password remains valid for signing in until an administrator reviews and approves this request. You will receive an email confirmation once approved.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onClose}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Got It
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Existing Pending Request Notice */}
              {hasPending && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                    color: '#facc15',
                  }}
                >
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  <span>
                    You already have a pending request {pendingDate ? `from ${pendingDate}` : ''}. Submitting now will replace it.
                  </span>
                </div>
              )}

              {error && (
                <div
                  style={{
                    background: 'var(--danger-bg, rgba(239, 68, 68, 0.1))',
                    border: '1px solid var(--danger-border, rgba(239, 68, 68, 0.3))',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#fca5a5',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Current Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    className="input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ paddingRight: '2.4rem', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      position: 'absolute',
                      right: '0.35rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '0.2rem',
                    }}
                  >
                    {showCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  New Password (min 8 characters) <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ paddingRight: '2.4rem', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      position: 'absolute',
                      right: '0.35rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '0.2rem',
                    }}
                  >
                    {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Confirm New Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ paddingRight: '2.4rem', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      position: 'absolute',
                      right: '0.35rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '0.2rem',
                    }}
                  >
                    {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Optional Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Periodic security update"
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

              {/* Security Hint */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.8rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  lineHeight: 1.4,
                }}
              >
                <HelpCircle size={13} style={{ color: 'var(--primary, #6366f1)', flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Admin approval is required to protect your vault. Your password will update as soon as the administrator verifies your request.
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? (
                  <>
                    <RotateCw size={13} className="spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
