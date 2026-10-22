import React, { useState } from 'react';
import { apiRegister } from '../auth/auth.api.js';
import {
  UserPlus,
  User,
  Mail,
  Phone,
  Building,
  BadgeCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';

interface RegisterCardProps {
  onBackToSignIn: () => void;
}

export const RegisterCard: React.FC<RegisterCardProps> = ({ onBackToSignIn }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRegister({
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        department: department.trim() || undefined,
        employeeId: employeeId.trim(),
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration could not be submitted. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ maxWidth: '440px', margin: '3rem auto', width: '100%' }}>
        <div className="card" style={{ padding: '2.5rem 2rem', background: 'var(--bg-surface-elevated)', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--success-bg, rgba(34, 197, 94, 0.15))',
              border: '1px solid var(--success-border, rgba(34, 197, 94, 0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: 'var(--success, #22c55e)',
            }}
          >
            <CheckCircle2 size={30} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
            Registration Submitted
          </h2>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            Your registration has been submitted successfully. Your account is currently waiting for approval. You will be able to sign in after an administrator approves your registration and sends your login credentials.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onBackToSignIn}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ArrowLeft size={15} />
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '440px', margin: '2.5rem auto', width: '100%' }}>
      <div className="card" style={{ padding: '2rem 1.85rem', background: 'var(--bg-surface-elevated)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-subtle)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
              color: 'var(--primary)',
            }}
          >
            <UserPlus size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Create Your Account
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Submit your details to request access to the application.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              marginBottom: '1.15rem',
              fontSize: '0.8rem',
              color: '#fca5a5',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
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
                <User size={14} />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. Sarah Jenkins"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label">Email Address <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
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
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@college.edu"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label">Phone Number</label>
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
                <Phone size={14} />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 000-0000"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          {/* Department */}
          <div className="form-group">
            <label className="form-label">Department</label>
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
                <Building size={14} />
              </div>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science, Administration"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          {/* Employee ID */}
          <div className="form-group">
            <label className="form-label">Employee ID <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
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
                <BadgeCheck size={14} />
              </div>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. EMP042"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '0.4rem', justifyContent: 'center' }}
          >
            {submitting ? (
              <>
                <RotateCw size={14} className="spin" />
                Submitting Registration...
              </>
            ) : (
              <>
                Submit Registration
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Back to Sign In Link */}
        <div style={{ marginTop: '1.35rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onBackToSignIn}
              className="btn-link"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
