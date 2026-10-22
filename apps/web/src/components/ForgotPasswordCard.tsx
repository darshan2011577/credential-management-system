import React, { useState } from 'react';
import { submitForgotPasswordRequest } from '../services/password-request.api.js';
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RotateCw,
  Send,
  HelpCircle,
} from 'lucide-react';

interface ForgotPasswordCardProps {
  onBackToSignIn: () => void;
}

export const ForgotPasswordCard: React.FC<ForgotPasswordCardProps> = ({ onBackToSignIn }) => {
  const [emailOrEmployeeId, setEmailOrEmployeeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const identifier = emailOrEmployeeId.trim();
    if (!identifier) {
      setError('Please enter your email address or Employee ID.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await submitForgotPasswordRequest({
        emailOrEmployeeId: identifier,
        newPassword,
        reason: reason.trim() || undefined,
      });

      setIsSuccess(true);
      setSuccessMessage(
        result.message ||
          'Your password reset request has been submitted to the administrator. Once approved, you will be able to sign in with your new password.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit password reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '2.5rem auto', width: '100%' }}>
      <div className="card" style={{ padding: '2rem 1.85rem', background: 'var(--bg-surface-elevated)' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
              color: 'var(--primary, #6366f1)',
            }}
          >
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Reset Your Password
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Submit a password reset request for administrator review.
          </p>
        </div>

        {/* Success Confirmation Screen */}
        {isSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
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
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                Request Submitted
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {successMessage}
              </p>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textAlign: 'left',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>What happens next?</strong>
              <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                <li>An administrator will review and verify your identity.</li>
                <li>Upon approval, your new password will be activated immediately.</li>
                <li>A confirmation notification will be sent to your registered email.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onBackToSignIn}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </button>
          </div>
        ) : (
          /* Reset Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div
                style={{
                  background: 'var(--danger-bg, rgba(239, 68, 68, 0.1))',
                  border: '1px solid var(--danger-border, rgba(239, 68, 68, 0.3))',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  color: '#fca5a5',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Email or Employee ID */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>
                Email Address or Employee ID <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <Mail size={14} />
                </div>
                <input
                  type="text"
                  required
                  value={emailOrEmployeeId}
                  onChange={(e) => {
                    setEmailOrEmployeeId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="name@company.com or EMP001"
                  className="input"
                  style={{ paddingLeft: '2.2rem', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            {/* New Desired Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>
                New Desired Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <Lock size={14} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="input"
                  style={{ paddingLeft: '2.2rem', paddingRight: '2.4rem', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    position: 'absolute',
                    right: '0.4rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.2rem',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>
                Confirm New Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <Lock size={14} />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Repeat new password"
                  className="input"
                  style={{ paddingLeft: '2.2rem', paddingRight: '2.4rem', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    position: 'absolute',
                    right: '0.4rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.2rem',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Reason / Note for Administrator */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Forgot starter password, need access restored"
                className="input"
                style={{ fontSize: '0.84rem' }}
              />
            </div>

            {/* Info Box */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                lineHeight: 1.4,
              }}
            >
              <HelpCircle size={14} style={{ color: 'var(--primary, #6366f1)', flexShrink: 0, marginTop: '2px' }} />
              <span>
                For security, your password will not be changed immediately. It will be sent to the system administrator for review and approval.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.25rem', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <RotateCw size={14} className="spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Submit Request for Approval
                </>
              )}
            </button>

            {/* Back to Sign In */}
            <button
              type="button"
              onClick={onBackToSignIn}
              className="btn btn-secondary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
            >
              <ArrowLeft size={13} />
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
