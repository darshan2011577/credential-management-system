import React, { useState } from 'react';
import { useAuth } from '../auth/auth.context.js';
import { AUTH_CONFIG } from '@credential-manager/config';
import { RegisterCard } from './RegisterCard.js';
import { ForgotPasswordCard } from './ForgotPasswordCard.js';
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  ArrowRight,
  RotateCw,
} from 'lucide-react';

interface LoginCardProps {}

export const LoginCard: React.FC<LoginCardProps> = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isRegistering) {
    return <RegisterCard onBackToSignIn={() => setIsRegistering(false)} />;
  }

  if (isForgotPassword) {
    return <ForgotPasswordCard onBackToSignIn={() => setIsForgotPassword(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  };

  const handleQuickFill = (role: 'ADMIN' | 'EMPLOYEE') => {
    clearError();
    if (role === 'ADMIN') {
      setEmail(AUTH_CONFIG.bootstrap.defaultAdminEmail);
      setPassword(AUTH_CONFIG.bootstrap.defaultAdminPassword);
    } else {
      setEmail(AUTH_CONFIG.bootstrap.defaultEmployeeEmail);
      setPassword(AUTH_CONFIG.bootstrap.defaultEmployeePassword);
    }
  };

  // Preserve friendly status messages, while standardizing invalid credentials
  const displayError = error
    ? error.toLowerCase().includes('waiting for administrator approval') ||
      error.toLowerCase().includes('not been approved') ||
      error.toLowerCase().includes('wait for your login credentials') ||
      error.toLowerCase().includes('currently disabled')
      ? error
      : error.toLowerCase().includes('invalid email') ||
        error.toLowerCase().includes('invalid password') ||
        error.toLowerCase().includes('unauthorized')
      ? 'Email or password is incorrect.'
      : error
    : null;

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto', width: '100%' }}>
      <div className="card" style={{ padding: '2rem 1.85rem', background: 'var(--bg-surface-elevated)' }}>
        {/* Brand Header */}
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
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Sign in to continue to your account.
          </p>
        </div>

        {/* Error Banner */}
        {displayError && (
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
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{displayError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
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
                  if (error) clearError();
                }}
                placeholder="name@college.edu"
                className="input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setIsForgotPassword(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Forgot Password?
              </button>
            </div>
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
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                placeholder="••••••••"
                className="input"
                style={{ paddingLeft: '2.2rem', paddingRight: '2.4rem' }}
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

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || isLoading}
            style={{ width: '100%', marginTop: '0.35rem', justifyContent: 'center' }}
          >
            {submitting || isLoading ? (
              <>
                <RotateCw size={14} className="spin" />
                Signing In...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Register Account Switch */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Need an account?{' '}
            <button
              type="button"
              onClick={() => {
                clearError();
                setIsRegistering(true);
              }}
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
              Create Your Account
            </button>
          </p>
        </div>

        {/* Quick-Fill Presets */}
        {/* <div style={{ marginTop: '1.25rem', paddingTop: '1.15rem', borderTop: '1px solid var(--border-default)' }}>
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              marginBottom: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Sign In
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickFill('ADMIN')}
              style={{ justifyContent: 'center', fontSize: '0.76rem' }}
            >
              <ShieldCheck size={13} color="var(--purple)" />
              Administrator
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickFill('EMPLOYEE')}
              style={{ justifyContent: 'center', fontSize: '0.76rem' }}
            >
              <UserCheck size={13} color="var(--success)" />
              Employee
            </button>
          </div>
        </div> */}
      </div>
    </div>
  );
};
