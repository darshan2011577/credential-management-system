import React, { useState, useEffect } from 'react';
import {
  PublicShareAccessData,
  PublicShareMetadata,
} from '@credential-manager/types';
import {
  downloadPublicFile,
  fetchPublicShareMetadata,
  requestPublicShareOtp,
  verifyPublicShareOtp,
} from '../../services/credential-share.api.js';
import {
  Shield,
  Key,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Mail,
  ArrowRight,
  ExternalLink,
  Archive,
} from 'lucide-react';

interface ExternalShareAccessViewProps {
  token: string;
}

export const ExternalShareAccessView: React.FC<ExternalShareAccessViewProps> = ({ token }) => {
  const [metadata, setMetadata] = useState<PublicShareMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verification Step: 'ENTER_EMAIL' | 'ENTER_OTP' | 'UNLOCKED'
  const [stage, setStage] = useState<'ENTER_EMAIL' | 'ENTER_OTP' | 'UNLOCKED'>('ENTER_EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Unlocked Data
  const [accessData, setAccessData] = useState<PublicShareAccessData | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fileCredentialPassword, setFileCredentialPassword] = useState('');
  const [showFilePassword, setShowFilePassword] = useState(false);

  useEffect(() => {
    if (token) {
      setLoading(true);
      setError(null);
      fetchPublicShareMetadata(token)
        .then((res) => {
          setMetadata(res.metadata);
          if (res.metadata.isExpired) {
            setError('This shared item has expired and is no longer accessible.');
          } else if (res.metadata.isRevoked) {
            setError('This shared item has been revoked by the owner.');
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Invalid or expired share link.');
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsRequestingOtp(true);
    setError(null);
    try {
      const res = await requestPublicShareOtp(token, email.trim());
      setOtpMessage(res.message || 'Verification code sent to your email.');
      setStage('ENTER_OTP');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setError(null);
    try {
      const res = await verifyPublicShareOtp(token, email.trim(), otp.trim());
      setAccessData(res.accessData);
      setStage('UNLOCKED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleDownload = async () => {
    if (!accessData?.file) return;
    if (accessData.file.isCredentialProtected && !fileCredentialPassword) {
      setError('Please enter the linked credential password to download this protected file.');
      return;
    }

    setIsDownloading(true);
    setError(null);
    try {
      await downloadPublicFile(token, accessData.file.fileName, fileCredentialPassword);
      if (typeof accessData.file.remainingDownloads === 'number') {
        setAccessData({
          ...accessData,
          file: {
            ...accessData.file,
            remainingDownloads: Math.max(0, accessData.file.remainingDownloads - 1),
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <RefreshCw size={32} className="spin" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, var(--bg-app) 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              marginBottom: '0.75rem',
            }}
          >
            <Shield size={24} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Secure Shared Item
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Protected with end-to-end authorization & identity verification
          </p>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div
            className="alert alert-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* STAGE 1: Confirm Email & Request Verification Code */}
        {/* =================================================================== */}
        {stage === 'ENTER_EMAIL' && metadata && !metadata.isExpired && !metadata.isRevoked && (
          <div>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                {metadata.resourceType === 'FILE' ? (
                  <FileText size={16} color="var(--primary)" />
                ) : (
                  <Key size={16} color="var(--purple)" />
                )}
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {metadata.itemSummary.title || metadata.itemSummary.fileName || 'Shared Resource'}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Shared by <strong style={{ color: 'var(--text-primary)' }}>{metadata.senderName}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                Available until {new Date(metadata.expiresAt).toLocaleDateString()}
              </div>
            </div>

            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>
                  Confirm Your Recipient Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="input"
                    placeholder="Enter the email where you received this link"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ paddingLeft: '2.2rem' }}
                  />
                  <Mail
                    size={15}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  We will send a one-time 6-digit verification code to confirm access.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isRequestingOtp}
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              >
                {isRequestingOtp ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* STAGE 2: Enter 6-digit OTP */}
        {/* =================================================================== */}
        {stage === 'ENTER_OTP' && (
          <div>
            {otpMessage && (
              <div
                className="alert alert-success"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}
              >
                <CheckCircle size={16} />
                <span>{otpMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0, textAlign: 'center' }}>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="• • • • • •"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{
                    fontSize: '1.4rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '0.65rem',
                  }}
                  autoFocus
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Delivered to <strong>{email}</strong>
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isVerifyingOtp || otp.length !== 6}
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Unlock</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStage('ENTER_EMAIL')}
                  style={{ fontSize: '0.76rem' }}
                >
                  Use a different email address
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* STAGE 3: Unlocked Shared Content View */}
        {/* =================================================================== */}
        {stage === 'UNLOCKED' && accessData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--success)',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              <CheckCircle size={16} />
              <span>Identity Verified • Access Unlocked</span>
            </div>

            {/* Credential Resource Unlocked */}
            {accessData.resourceType === 'CREDENTIAL' && accessData.credential && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={18} color="var(--purple)" />
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {accessData.credential.title}
                    </h3>
                    <span className="badge badge-purple" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                      {accessData.credential.category}
                    </span>
                  </div>
                </div>

                {accessData.credential.website && (
                  <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Website:</span>
                    <a
                      href={
                        accessData.credential.website.startsWith('http')
                          ? accessData.credential.website
                          : `https://${accessData.credential.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      {accessData.credential.website}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                <div style={{ fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {accessData.credential.username}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 4px' }}
                      onClick={() => handleCopy('user', accessData.credential!.username)}
                    >
                      {copiedField === 'user' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {accessData.credential.password ? (
                  <div style={{ fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Password:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {revealPassword ? accessData.credential.password : '••••••••••••'}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px' }}
                        onClick={() => setRevealPassword(!revealPassword)}
                      >
                        {revealPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px' }}
                        onClick={() => handleCopy('pwd', accessData.credential!.password!)}
                      >
                        {copiedField === 'pwd' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Password reveal was not granted by the sender for this share.
                  </div>
                )}

                {accessData.credential.notes && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Notes:</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {accessData.credential.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* File Resource Unlocked */}
            {accessData.resourceType === 'FILE' && accessData.file && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: accessData.file.isCompressed ? 'var(--purple-bg)' : 'var(--primary-bg)',
                    color: accessData.file.isCompressed ? 'var(--purple)' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  {accessData.file.isCompressed ? <Archive size={24} /> : <FileText size={24} />}
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {accessData.file.fileName}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {(accessData.file.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB • {accessData.file.mimeType}
                  </div>
                  {typeof accessData.file.remainingDownloads === 'number' && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--warning)', marginTop: '4px' }}>
                      {accessData.file.remainingDownloads} downloads remaining
                    </div>
                  )}
                </div>

                {accessData.file.isCredentialProtected && (
                  <div
                    style={{
                      background: 'var(--purple-bg)',
                      border: '1px solid var(--purple-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--purple)', fontSize: '0.82rem', fontWeight: 600 }}>
                      <Key size={14} />
                      <span>Credential Password Required</span>
                    </div>
                    {accessData.file.linkedCredentialTitle && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Linked Credential: <strong>{accessData.file.linkedCredentialTitle}</strong>
                      </div>
                    )}
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showFilePassword ? 'text' : 'password'}
                        className="input"
                        style={{ paddingRight: '2.5rem', fontSize: '0.82rem' }}
                        placeholder="Enter credential password to unlock download"
                        value={fileCredentialPassword}
                        onChange={(e) => setFileCredentialPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                        onClick={() => setShowFilePassword(!showFilePassword)}
                      >
                        {showFilePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {accessData.file.canDownload ? (
                  <button
                    className="btn btn-primary"
                    disabled={isDownloading || accessData.file.remainingDownloads === 0}
                    onClick={handleDownload}
                    style={{ justifyContent: 'center', padding: '0.65rem' }}
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Download Shared File</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    This file is shared for online viewing only. Download permission was not granted.
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Access valid until {new Date(accessData.expiresAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
