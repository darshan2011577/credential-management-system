import React, { useState, useEffect, useCallback } from 'react';
import {
  ICredentialShare,
  SharedCredentialItem,
  SharedFileItem,
} from '@credential-manager/types';
import {
  approveCredentialShare,
  downloadPanelFile,
  fetchEmailShares,
  fetchIncomingShares,
  fetchOutgoingShares,
  fetchSharedCredentials,
  fetchSharedFiles,
  rejectCredentialShare,
  resendEmailShare,
  revealSharedPassword,
  revokeCredentialShare,
} from '../../services/credential-share.api.js';
import { ShareModal } from './ShareModal.js';
import {
  Share2,
  Inbox,
  Send,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Download,
  FileText,
  Key,
  Archive,
  Plus,
  RotateCw,
  Ban,
  Lock,
  X,
} from 'lucide-react';

interface SharedCredentialsViewProps {
  onRefreshBadge?: (count: number) => void;
}

export const SharedCredentialsView: React.FC<SharedCredentialsViewProps> = ({
  onRefreshBadge,
}) => {
  const [subTab, setSubTab] = useState<'sharedWithMe' | 'pendingRequests' | 'sharedByMe' | 'emailShares'>(
    'sharedWithMe'
  );
  const [sharedCredentials, setSharedCredentials] = useState<SharedCredentialItem[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFileItem[]>([]);
  const [incomingShares, setIncomingShares] = useState<ICredentialShare[]>([]);
  const [outgoingShares, setOutgoingShares] = useState<ICredentialShare[]>([]);
  const [emailShares, setEmailShares] = useState<ICredentialShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Reveal & Copy state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingIds, setRevealingIds] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Unlock Protected File Modal State
  const [unlockModalFile, setUnlockModalFile] = useState<SharedFileItem | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [actionLoadingIds, setActionLoadingIds] = useState<Record<string, boolean>>({});

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [credRes, fileRes, incomingRes, outgoingRes, emailRes] = await Promise.all([
        fetchSharedCredentials(),
        fetchSharedFiles(),
        fetchIncomingShares(),
        fetchOutgoingShares(),
        fetchEmailShares(),
      ]);

      setSharedCredentials(credRes.items);
      setSharedFiles(fileRes.items);
      setIncomingShares(incomingRes.shares);
      setOutgoingShares(outgoingRes.shares);
      setEmailShares(emailRes.shares);

      const pendingCount = incomingRes.shares.filter((s) => s.status === 'PENDING').length;
      onRefreshBadge?.(pendingCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sharing records.');
    } finally {
      setLoading(false);
    }
  }, [onRefreshBadge]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (shareId: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [shareId]: true }));
    try {
      await approveCredentialShare(shareId);
      showNotification('Share request approved. The item is now available in Shared With Me.');
      await loadData();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to approve share.', 'error');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [shareId]: false }));
    }
  };

  const handleReject = async (shareId: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [shareId]: true }));
    try {
      await rejectCredentialShare(shareId);
      showNotification('Share request declined.');
      await loadData();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to decline share.', 'error');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [shareId]: false }));
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!window.confirm('Are you sure you want to revoke this share? The recipient will immediately lose access.')) {
      return;
    }

    setActionLoadingIds((prev) => ({ ...prev, [shareId]: true }));
    try {
      await revokeCredentialShare(shareId);
      showNotification('Share revoked. Recipient access terminated immediately.');
      await loadData();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to revoke share.', 'error');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [shareId]: false }));
    }
  };

  const handleResendEmail = async (shareId: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [shareId]: true }));
    try {
      const res = await resendEmailShare(shareId);
      if (res.success) {
        showNotification('Sharing link email resent successfully.');
      } else {
        showNotification(res.message || 'Email delivery failed. Please try again.', 'error');
      }
      await loadData();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to resend email.', 'error');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [shareId]: false }));
    }
  };

  const handleDownloadFile = async (shareId: string, filename: string, password?: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [shareId]: true }));
    try {
      await downloadPanelFile(shareId, filename, password);
      showNotification(`Downloading "${filename}"...`);
      await loadData();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to download file.', 'error');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [shareId]: false }));
    }
  };

  const onFileDownloadClick = (file: SharedFileItem) => {
    if (file.isCredentialProtected) {
      setUnlockModalFile(file);
      setUnlockPassword('');
      setShowUnlockPassword(false);
      setUnlockError(null);
    } else {
      handleDownloadFile(file.shareId, file.originalName);
    }
  };

  const handleConfirmUnlockDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockModalFile) return;
    if (!unlockPassword) {
      setUnlockError('Please enter the credential password.');
      return;
    }

    setUnlockLoading(true);
    setUnlockError(null);
    try {
      await downloadPanelFile(unlockModalFile.shareId, unlockModalFile.originalName, unlockPassword);
      showNotification(`Downloading "${unlockModalFile.originalName}"...`);
      setUnlockModalFile(null);
      await loadData();
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Invalid credential password.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleToggleReveal = async (credentialId: string) => {
    if (revealedPasswords[credentialId]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[credentialId];
        return next;
      });
      return;
    }

    setRevealingIds((prev) => ({ ...prev, [credentialId]: true }));
    try {
      const data = await revealSharedPassword(credentialId);
      setRevealedPasswords((prev) => ({ ...prev, [credentialId]: data.password }));
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to reveal password.', 'error');
    } finally {
      setRevealingIds((prev) => ({ ...prev, [credentialId]: false }));
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const pendingIncomingCount = incomingShares.filter((s) => s.status === 'PENDING').length;
  const totalSharedWithMe = sharedCredentials.length + sharedFiles.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Primary Actions */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          padding: '1.15rem 1.35rem',
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
            <Share2 size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Secure Sharing Hub
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Share account credentials and secure files with colleagues inside the portal or via verified email links.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsShareModalOpen(true)}>
            <Plus size={13} />
            Share Item
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: actionMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: actionMessage.type === 'success' ? '#34d399' : '#f87171',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
          }}
        >
          {actionMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: '#f87171',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${subTab === 'sharedWithMe' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('sharedWithMe')}
        >
          <Inbox size={13} />
          Shared With Me ({totalSharedWithMe})
        </button>

        <button
          className={`btn btn-sm ${subTab === 'pendingRequests' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('pendingRequests')}
        >
          <Clock size={13} />
          Incoming Requests
          {pendingIncomingCount > 0 && (
            <span
              style={{
                background: 'var(--danger)',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {pendingIncomingCount}
            </span>
          )}
        </button>

        <button
          className={`btn btn-sm ${subTab === 'sharedByMe' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('sharedByMe')}
        >
          <Send size={13} />
          Shared By Me ({outgoingShares.length})
        </button>

        <button
          className={`btn btn-sm ${subTab === 'emailShares' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('emailShares')}
        >
          <Mail size={13} />
          Email Shares ({emailShares.length})
        </button>
      </div>

      {/* ===================================================================== */}
      {/* Sub-View 1: Shared With Me (Credentials & Files) */}
      {/* ===================================================================== */}
      {subTab === 'sharedWithMe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Loading shared items...
            </div>
          ) : totalSharedWithMe === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <Inbox size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Shared Items
              </h4>
              <p style={{ fontSize: '0.8rem', maxWidth: '400px', margin: '0 auto' }}>
                Credentials and files shared with you by other employees will appear here once approved.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {/* Credentials */}
              {sharedCredentials.map((item) => (
                <div key={item.shareId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Key size={15} color="var(--purple)" />
                        <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.title}
                        </h4>
                      </div>
                      <span className="badge badge-purple" style={{ fontSize: '0.68rem', marginTop: '3px' }}>
                        {item.category}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: item.permission === 'VIEW_REVEAL' ? '#38bdf8' : 'var(--text-muted)',
                        background: item.permission === 'VIEW_REVEAL' ? 'rgba(56,189,248,0.1)' : 'var(--bg-surface)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      {item.permission === 'VIEW_REVEAL' ? 'Reveal Allowed' : 'View Only'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.username}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 4px' }}
                          onClick={() => handleCopy(`user-${item.shareId}`, item.username)}
                        >
                          {copiedField === `user-${item.shareId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    {item.permission === 'VIEW_REVEAL' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Password:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {revealedPasswords[item.credentialId] || '••••••••••••'}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 4px' }}
                            disabled={revealingIds[item.credentialId]}
                            onClick={() => handleToggleReveal(item.credentialId)}
                          >
                            {revealedPasswords[item.credentialId] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          {revealedPasswords[item.credentialId] && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 4px' }}
                              onClick={() => handleCopy(`pwd-${item.shareId}`, revealedPasswords[item.credentialId])}
                            >
                              {copiedField === `pwd-${item.shareId}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>Shared by {item.owner.name}</span>
                    <span>Expires {new Date(item.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}

              {/* Shared Files */}
              {sharedFiles.map((file) => (
                <div key={file.shareId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {file.isCompressed ? <Archive size={15} color="var(--purple)" /> : <FileText size={15} color="var(--primary)" />}
                        <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {file.originalName}
                        </h4>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {(file.sizeBytes / 1024).toFixed(0)} KB {file.isCompressed && file.fileCount ? `• ${file.fileCount} files in ZIP` : ''}
                      </div>
                      {file.isCredentialProtected && (
                        <div
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: 'var(--purple)',
                            background: 'var(--purple-bg)',
                            border: '1px solid var(--purple-border)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '4px',
                          }}
                        >
                          <Key size={10} />
                          {file.linkedCredentialTitle ? `Password Required (${file.linkedCredentialTitle})` : 'Credential Protected'}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: file.permission !== 'VIEW' ? 'var(--success)' : 'var(--text-muted)',
                        background: file.permission !== 'VIEW' ? 'rgba(52,211,153,0.1)' : 'var(--bg-surface)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      {file.permission !== 'VIEW' ? 'Download Allowed' : 'View Only'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Shared by <strong style={{ color: 'var(--text-primary)' }}>{file.owner.name}</strong>
                      {typeof file.maxDownloads === 'number' && (
                        <div>
                          Downloads: {file.downloadCount}/{file.maxDownloads}
                        </div>
                      )}
                    </div>

                    {file.permission !== 'VIEW' && (
                      <button
                        className={`btn btn-sm ${file.isCredentialProtected ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={
                          actionLoadingIds[file.shareId] ||
                          (typeof file.maxDownloads === 'number' && file.downloadCount >= file.maxDownloads)
                        }
                        onClick={() => onFileDownloadClick(file)}
                      >
                        {file.isCredentialProtected ? <Lock size={13} color="var(--purple)" /> : <Download size={13} />}
                        {file.isCredentialProtected ? 'Unlock & Download' : 'Download'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* Sub-View 2: Incoming Requests (Pending Approvals) */}
      {/* ===================================================================== */}
      {subTab === 'pendingRequests' && (
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Loading requests...
            </div>
          ) : incomingShares.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Incoming Requests
              </h4>
              <p style={{ fontSize: '0.8rem', maxWidth: '400px', margin: '0 auto' }}>
                When another employee shares a credential or file with you, it will appear here for review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {incomingShares.map((share) => (
                <div
                  key={share.id}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--primary-bg)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {share.resourceType === 'FILE' ? <FileText size={18} /> : <Key size={18} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                        {share.resourceType === 'FILE'
                          ? share.fileMetadata?.originalName || 'File Package'
                          : share.credential?.title || 'Credential'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        From <strong style={{ color: 'var(--text-secondary)' }}>{share.owner?.name}</strong> • Permission:{' '}
                        <span style={{ color: '#38bdf8' }}>{share.permission}</span> • Expires:{' '}
                        {new Date(share.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {share.status === 'PENDING' ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={actionLoadingIds[share.id]}
                          onClick={() => handleReject(share.id)}
                        >
                          Decline
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={actionLoadingIds[share.id]}
                          onClick={() => handleApprove(share.id)}
                        >
                          Accept Access
                        </button>
                      </>
                    ) : (
                      <span className={`badge badge-${share.status.toLowerCase()}`}>{share.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* Sub-View 3: Shared By Me (Outgoing Panel Shares) */}
      {/* ===================================================================== */}
      {subTab === 'sharedByMe' && (
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Loading outgoing shares...
            </div>
          ) : outgoingShares.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <Send size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Outgoing Shares
              </h4>
              <p style={{ fontSize: '0.8rem', maxWidth: '400px', margin: '0 auto' }}>
                Items you share with other employees inside the application will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {outgoingShares.map((share) => (
                <div
                  key={share.id}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                      }}
                    >
                      {share.resourceType === 'FILE' ? <FileText size={18} /> : <Key size={18} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                        {share.resourceType === 'FILE'
                          ? share.fileMetadata?.originalName || 'File Package'
                          : share.credential?.title || 'Credential'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Shared with <strong style={{ color: 'var(--text-secondary)' }}>{share.recipient?.name}</strong> •{' '}
                        Permission: <span style={{ color: '#38bdf8' }}>{share.permission}</span> • Expires:{' '}
                        {new Date(share.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span className={`badge badge-${share.status.toLowerCase()}`}>{share.status}</span>
                    {share.status !== 'REVOKED' && share.status !== 'EXPIRED' && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionLoadingIds[share.id]}
                        onClick={() => handleRevoke(share.id)}
                      >
                        <Ban size={13} />
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* Sub-View 4: Email Shares (Outgoing Email Links) */}
      {/* ===================================================================== */}
      {subTab === 'emailShares' && (
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Loading email shares...
            </div>
          ) : emailShares.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <Mail size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Email Shares
              </h4>
              <p style={{ fontSize: '0.8rem', maxWidth: '400px', margin: '0 auto' }}>
                Items shared via secure email links will be listed here with delivery and expiration status.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Recipient Email</th>
                    <th>Shared Item</th>
                    <th>Type</th>
                    <th>Permission</th>
                    <th>Delivery</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailShares.map((share) => {
                    const itemTitle =
                      share.resourceType === 'FILE'
                        ? share.fileMetadata?.originalName || 'File Package'
                        : share.credential?.title || 'Credential';

                    const isExpired = new Date(share.expiresAt) <= new Date() || share.status === 'EXPIRED';

                    return (
                      <tr key={share.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{share.recipientEmail}</td>
                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {itemTitle}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: share.resourceType === 'FILE' ? 'var(--primary)' : 'var(--purple)',
                            }}
                          >
                            {share.resourceType}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{share.permission}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: share.deliveryStatus === 'SENT' ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {share.deliveryStatus || 'SENT'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {new Date(share.expiresAt).toLocaleDateString()}
                        </td>
                        <td>
                          <span className={`badge badge-${share.status.toLowerCase()}`}>
                            {isExpired && share.status !== 'REVOKED' ? 'EXPIRED' : share.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            {share.status !== 'REVOKED' && !isExpired && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Resend email notification"
                                  disabled={actionLoadingIds[share.id]}
                                  onClick={() => handleResendEmail(share.id)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                                >
                                  <RotateCw size={12} />
                                  Resend
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  title="Revoke access immediately"
                                  disabled={actionLoadingIds[share.id]}
                                  onClick={() => handleRevoke(share.id)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                                >
                                  <Ban size={12} />
                                  Revoke
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unified Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShareCreated={loadData}
      />

      {/* Unlock Protected File Modal */}
      {unlockModalFile && (
        <div className="modal-backdrop" onClick={() => !unlockLoading && setUnlockModalFile(null)}>
          <div
            className="modal"
            style={{ maxWidth: '440px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--purple-bg)',
                    color: 'var(--purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Key size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Unlock Protected File
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Enter the linked credential password to authorize download.
                  </p>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setUnlockModalFile(null)}
                disabled={unlockLoading}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmUnlockDownload}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {unlockError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger-border)',
                      color: '#f87171',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{unlockError}</span>
                  </div>
                )}

                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.75rem 0.95rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    File to Download
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {unlockModalFile.originalName}
                  </div>
                  {unlockModalFile.linkedCredentialTitle && (
                    <div style={{ color: 'var(--purple)', fontSize: '0.75rem', fontWeight: 600, marginTop: '2px' }}>
                      Linked Credential: {unlockModalFile.linkedCredentialTitle}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Credential Password <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showUnlockPassword ? 'text' : 'password'}
                      className="input"
                      style={{ paddingRight: '2.5rem' }}
                      placeholder="Enter credential password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    >
                      {showUnlockPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUnlockModalFile(null)}
                  disabled={unlockLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={unlockLoading}>
                  {unlockLoading ? (
                    <>
                      <RefreshCw size={13} className="spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      Verify & Download
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
