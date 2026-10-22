import React, { useState, useEffect, useRef } from 'react';
import {
  ICredentialListItem,
  ShareRecipientOption,
  ShareResourceType,
  ShareMethod,
  UnifiedSharePermission,
} from '@credential-manager/types';
import { FILE_SHARE_CONFIG } from '@credential-manager/config';
import {
  createCredentialShare,
  createShareWithFiles,
  fetchEligibleRecipients,
} from '../../services/credential-share.api.js';
import { fetchCredentials } from '../../services/credential.api.js';
import {
  Share2,
  X,
  Eye,
  Lock,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
  Key,
  Users,
  Mail,
  UploadCloud,
  Trash2,
  Archive,
  ArrowRight,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCredential?: ICredentialListItem | null;
  onShareCreated?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  preselectedCredential,
  onShareCreated,
}) => {
  // Mode selection
  const [resourceType, setResourceType] = useState<ShareResourceType>(
    preselectedCredential ? 'CREDENTIAL' : 'CREDENTIAL'
  );
  const [shareMethod, setShareMethod] = useState<ShareMethod>('PANEL');

  // Recipient state
  const [recipients, setRecipients] = useState<ShareRecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');

  // Credential state
  const [credentialsList, setCredentialsList] = useState<ICredentialListItem[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
    preselectedCredential?.id || ''
  );
  const [credentialPermission, setCredentialPermission] = useState<UnifiedSharePermission>('VIEW_REVEAL');

  // File state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [compressFiles, setCompressFiles] = useState(false);
  const [filePermission, setFilePermission] = useState<UnifiedSharePermission>('VIEW_DOWNLOAD');
  const [maxDownloadsOption, setMaxDownloadsOption] = useState<'unlimited' | '1' | '3' | '5'>('unlimited');
  const [isCredentialProtected, setIsCredentialProtected] = useState(false);
  const [linkedCredentialId, setLinkedCredentialId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expiration
  const [expirationOption, setExpirationOption] = useState<'1h' | '24h' | '3d' | '7d' | '30d' | 'custom'>('7d');
  const [customExpiresAt, setCustomExpiresAt] = useState<string>('');

  // UI state
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [loadingCredentials, setLoadingCredentials] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setShowSummary(false);
      setSelectedFiles([]);
      setCompressFiles(false);
      setIsCredentialProtected(false);

      if (preselectedCredential) {
        setResourceType('CREDENTIAL');
        setSelectedCredentialId(preselectedCredential.id);
        setLinkedCredentialId(preselectedCredential.id);
        setCredentialsList([preselectedCredential]);
      }

      setLoadingCredentials(true);
      fetchCredentials({ limit: 100 })
        .then((res) => {
          setCredentialsList(res.items);
          if (res.items.length > 0) {
            if (!preselectedCredential && !selectedCredentialId) {
              setSelectedCredentialId(res.items[0].id);
            }
            if (!linkedCredentialId) {
              setLinkedCredentialId(res.items[0].id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCredentials(false));

      setLoadingRecipients(true);
      fetchEligibleRecipients()
        .then((res) => {
          setRecipients(res.recipients);
          if (res.recipients.length > 0) {
            setSelectedRecipientId(res.recipients[0].id);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load eligible employees.');
        })
        .finally(() => setLoadingRecipients(false));

      const defaultCustom = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setCustomExpiresAt(defaultCustom.toISOString().slice(0, 16));
    }
  }, [isOpen, preselectedCredential]);

  if (!isOpen) return null;

  const calculateExpiresAt = (): string => {
    const now = Date.now();
    if (expirationOption === '1h') {
      return new Date(now + 60 * 60 * 1000).toISOString();
    } else if (expirationOption === '24h') {
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationOption === '3d') {
      return new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationOption === '7d') {
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationOption === '30d') {
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      return new Date(customExpiresAt).toISOString();
    }
  };

  const totalFilesSizeBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const totalFilesSizeMB = (totalFilesSizeBytes / (1024 * 1024)).toFixed(1);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    const combined = [...selectedFiles, ...newFiles].slice(0, FILE_SHARE_CONFIG.maxFilesCount);

    // Validate size & extensions
    const maxFileSize = FILE_SHARE_CONFIG.maxFileSizeMB * 1024 * 1024;
    for (const f of combined) {
      if (f.size > maxFileSize) {
        setError(`File "${f.name}" exceeds the maximum limit of ${FILE_SHARE_CONFIG.maxFileSizeMB} MB.`);
        return;
      }
    }

    setSelectedFiles(combined);
    if (combined.length > 1) {
      setCompressFiles(true);
    }
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    if (updated.length <= 1) {
      setCompressFiles(false);
    }
  };

  const handleProceedToSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (resourceType === 'CREDENTIAL' && !selectedCredentialId) {
      setError('Please select a credential to share.');
      return;
    }

    if (resourceType === 'FILE' && selectedFiles.length === 0) {
      setError('Please upload at least one file to share.');
      return;
    }

    if (shareMethod === 'PANEL' && !selectedRecipientId) {
      setError('Please select a recipient employee.');
      return;
    }

    if (shareMethod === 'EMAIL' && (!recipientEmail || !recipientEmail.includes('@'))) {
      setError('Please enter a valid recipient email address.');
      return;
    }

    const expiresAt = calculateExpiresAt();
    if (new Date(expiresAt).getTime() <= Date.now()) {
      setError('Expiration date must be in the future.');
      return;
    }

    setShowSummary(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const expiresAt = calculateExpiresAt();
    const maxDownloads = maxDownloadsOption === 'unlimited' ? undefined : Number(maxDownloadsOption);

    try {
      if (resourceType === 'CREDENTIAL') {
        await createCredentialShare({
          resourceType: 'CREDENTIAL',
          shareMethod,
          credentialId: selectedCredentialId,
          recipientId: shareMethod === 'PANEL' ? selectedRecipientId : undefined,
          recipientEmail: shareMethod === 'EMAIL' ? recipientEmail.trim() : undefined,
          permission: credentialPermission,
          expiresAt,
        });

        const msg =
          shareMethod === 'PANEL'
            ? 'Credential shared successfully with employee.'
            : `Secure credential link sent successfully to ${recipientEmail}.`;
        setSuccessMessage(msg);
      } else {
        // File Sharing (Multipart FormData)
        const formData = new FormData();
        formData.append('resourceType', 'FILE');
        formData.append('shareMethod', shareMethod);
        if (shareMethod === 'PANEL') {
          formData.append('recipientId', selectedRecipientId);
        } else {
          formData.append('recipientEmail', recipientEmail.trim());
        }
        formData.append('permission', filePermission);
        formData.append('expiresAt', expiresAt);
        formData.append('compress', compressFiles ? 'true' : 'false');
        if (maxDownloads) {
          formData.append('maxDownloads', String(maxDownloads));
        }
        if (isCredentialProtected && linkedCredentialId) {
          formData.append('linkedCredentialId', linkedCredentialId);
        }

        for (const file of selectedFiles) {
          formData.append('files', file);
        }

        await createShareWithFiles(formData);

        const msg =
          shareMethod === 'PANEL'
            ? 'File package shared successfully with employee.'
            : `Secure file sharing link sent successfully to ${recipientEmail}.`;
        setSuccessMessage(msg);
      }

      onShareCreated?.();
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share.');
      setShowSummary(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetCredentialTitle =
    preselectedCredential?.title ||
    credentialsList.find((c) => c.id === selectedCredentialId)?.title ||
    'Selected Credential';

  const selectedEmployeeName =
    recipients.find((r) => r.id === selectedRecipientId)?.name || 'Selected Employee';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--purple-bg)',
                color: 'var(--purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--purple-border)',
              }}
            >
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                {showSummary ? 'Review & Confirm Share' : 'Share Item'}
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                {showSummary
                  ? 'Confirm details before creating the secure share.'
                  : 'Share credentials or files with employees or by secure email.'}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.2rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Success Feedback */}
        {successMessage ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <CheckCircle size={44} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Shared Successfully
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              {successMessage}
            </p>
          </div>
        ) : showSummary ? (
          /* Pre-Share Summary View */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    You Are Sharing
                  </span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                    {resourceType === 'CREDENTIAL' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Key size={14} color="var(--purple)" />
                        {targetCredentialTitle}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileText size={14} color="var(--primary)" />
                        {selectedFiles.length === 1
                          ? selectedFiles[0].name
                          : `${selectedFiles.length} files (${compressFiles ? 'ZIP package' : 'attached'})`}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({totalFilesSizeMB} MB)</span>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Recipient
                    </span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '2px' }}>
                      {shareMethod === 'PANEL' ? selectedEmployeeName : recipientEmail}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Method
                    </span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '2px' }}>
                      {shareMethod === 'PANEL' ? 'Employee Panel' : 'Secure Email Link'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Permission
                    </span>
                    <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem', marginTop: '2px' }}>
                      {resourceType === 'CREDENTIAL'
                        ? credentialPermission === 'VIEW_REVEAL'
                          ? 'View & Reveal Password'
                          : 'View Username Only'
                        : filePermission === 'VIEW_DOWNLOAD' || filePermission === 'DOWNLOAD'
                        ? 'View & Download File'
                        : 'View Online Only'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Access Duration
                    </span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '2px' }}>
                      {new Date(calculateExpiresAt()).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>
                </div>

                {resourceType === 'FILE' && maxDownloadsOption !== 'unlimited' && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Download Limit
                    </span>
                    <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: '0.85rem' }}>
                      Max {maxDownloadsOption} downloads
                    </div>
                  </div>
                )}

                {resourceType === 'FILE' && isCredentialProtected && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      background: 'var(--purple-bg)',
                      border: '1px solid var(--purple-border)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--purple)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    <Key size={13} />
                    <span>
                      Protected by:{' '}
                      {credentialsList.find((c) => c.id === linkedCredentialId)?.title || 'Saved Credential'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSummary(false)}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
              >
                <Share2 size={13} />
                {isSubmitting ? 'Sharing...' : 'Confirm & Share'}
              </button>
            </div>
          </div>
        ) : (
          /* Main Configuration Form */
          <form onSubmit={handleProceedToSummary} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {error && (
                <div className="alert alert-danger" style={{ fontSize: '0.8rem', padding: '0.65rem 0.85rem' }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: What to share */}
              <div>
                <label className="form-label" style={{ marginBottom: '0.35rem' }}>
                  What do you want to share?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${resourceType === 'CREDENTIAL' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setResourceType('CREDENTIAL')}
                    style={{ justifyContent: 'center', padding: '0.55rem' }}
                  >
                    <Key size={14} />
                    Credential
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${resourceType === 'FILE' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setResourceType('FILE')}
                    style={{ justifyContent: 'center', padding: '0.55rem' }}
                  >
                    <FileText size={14} />
                    File
                  </button>
                </div>
              </div>

              {/* Step 2: How to share */}
              <div>
                <label className="form-label" style={{ marginBottom: '0.35rem' }}>
                  How do you want to share?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${shareMethod === 'PANEL' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShareMethod('PANEL')}
                    style={{ justifyContent: 'center', padding: '0.55rem' }}
                  >
                    <Users size={14} />
                    With Employee
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${shareMethod === 'EMAIL' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShareMethod('EMAIL')}
                    style={{ justifyContent: 'center', padding: '0.55rem' }}
                  >
                    <Mail size={14} />
                    By Email
                  </button>
                </div>
              </div>

              {/* Resource Content Selector */}
              {resourceType === 'CREDENTIAL' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Select Credential <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  {preselectedCredential ? (
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem 0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                      }}
                    >
                      {preselectedCredential.title} ({preselectedCredential.username})
                    </div>
                  ) : credentialsList.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>No credentials found in vault.</div>
                  ) : (
                    <select
                      className="select"
                      value={selectedCredentialId}
                      onChange={(e) => setSelectedCredentialId(e.target.value)}
                      required
                    >
                      {credentialsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.username}) — {c.category}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                /* File Uploader Section */
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Upload File(s) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleFilesAdded(e.target.files)}
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      handleFilesAdded(e.dataTransfer.files);
                    }}
                    style={{
                      border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: isDragOver ? 'rgba(99,102,241,0.08)' : 'var(--bg-surface)',
                      padding: '1.25rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <UploadCloud size={28} color="var(--primary)" style={{ margin: '0 auto 0.4rem' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Click to browse or drag files here
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      PDF, Office docs, images, text, csv, zip (Max {FILE_SHARE_CONFIG.maxFileSizeMB}MB/file, up to{' '}
                      {FILE_SHARE_CONFIG.maxFilesCount} files)
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.4rem 0.65rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                            <FileText size={14} color="var(--primary)" />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '280px' }}>
                              {file.name}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            style={{ padding: '2px', color: 'var(--danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                      {/* Compression toggle */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          marginTop: '0.35rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={compressFiles}
                          onChange={(e) => setCompressFiles(e.target.checked)}
                        />
                        <Archive size={14} color="var(--purple)" />
                        <span>
                          {selectedFiles.length > 1
                            ? 'Compress files into a single ZIP package'
                            : 'Compress before sharing'}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient Input */}
              {shareMethod === 'PANEL' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Recipient Employee <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  {loadingRecipients ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading employee list...</div>
                  ) : recipients.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>No other eligible employees found.</div>
                  ) : (
                    <select
                      className="select"
                      value={selectedRecipientId}
                      onChange={(e) => setSelectedRecipientId(e.target.value)}
                      required
                    >
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.employeeId}) — {r.department || 'Faculty'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Recipient Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="e.g. partner@external.org or employee@college.edu"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Non-registered recipients will verify their identity with a 6-digit email OTP.
                  </span>
                </div>
              )}

              {/* Permissions */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Permission Level</label>
                {resourceType === 'CREDENTIAL' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${credentialPermission === 'VIEW_REVEAL' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCredentialPermission('VIEW_REVEAL')}
                      style={{ fontSize: '0.76rem', justifyContent: 'flex-start', padding: '0.45rem 0.65rem' }}
                    >
                      <Eye size={13} />
                      View & Reveal Password
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${credentialPermission === 'VIEW' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCredentialPermission('VIEW')}
                      style={{ fontSize: '0.76rem', justifyContent: 'flex-start', padding: '0.45rem 0.65rem' }}
                    >
                      <Lock size={13} />
                      View Username Only
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${filePermission === 'VIEW_DOWNLOAD' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFilePermission('VIEW_DOWNLOAD')}
                      style={{ fontSize: '0.76rem', justifyContent: 'flex-start', padding: '0.45rem 0.65rem' }}
                    >
                      <Download size={13} />
                      View & Download
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${filePermission === 'VIEW' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFilePermission('VIEW')}
                      style={{ fontSize: '0.76rem', justifyContent: 'flex-start', padding: '0.45rem 0.65rem' }}
                    >
                      <Eye size={13} />
                      View Online Only
                    </button>
                  </div>
                )}
              </div>

              {/* File Download Limits & Password Protection (Optional) */}
              {resourceType === 'FILE' && (
                <>
                  {/* Linked Credential Password Protection */}
                  <div
                    style={{
                      background: isCredentialProtected ? 'var(--purple-bg)' : 'var(--bg-surface)',
                      border: `1px solid ${isCredentialProtected ? 'var(--purple-border)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 0.95rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: isCredentialProtected ? 'var(--purple)' : 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isCredentialProtected}
                        onChange={(e) => {
                          setIsCredentialProtected(e.target.checked);
                          if (e.target.checked && credentialsList.length > 0 && !linkedCredentialId) {
                            setLinkedCredentialId(credentialsList[0].id);
                          }
                        }}
                      />
                      <Key size={14} />
                      <span>Protect File with a Saved Credential</span>
                    </label>

                    {isCredentialProtected && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.15rem' }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          Required Credential
                        </label>
                        {credentialsList.length === 0 ? (
                          <div style={{ fontSize: '0.76rem', color: 'var(--warning)' }}>
                            No credentials found in your vault. Create a credential first to use this protection.
                          </div>
                        ) : (
                          <select
                            className="select"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                            value={linkedCredentialId}
                            onChange={(e) => setLinkedCredentialId(e.target.value)}
                          >
                            {credentialsList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title} ({c.username}) — {c.category}
                              </option>
                            ))}
                          </select>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Recipients will be required to enter this credential's password to unlock and download the file.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Maximum Downloads</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                      {[
                        { key: 'unlimited', label: 'Unlimited' },
                        { key: '1', label: '1 Download' },
                        { key: '3', label: '3 Downloads' },
                        { key: '5', label: '5 Downloads' },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          className={`btn btn-sm ${maxDownloadsOption === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setMaxDownloadsOption(opt.key as any)}
                          style={{ fontSize: '0.72rem', padding: '0.35rem 0.45rem' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Expiration Presets */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Access Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.25rem' }}>
                  {[
                    { key: '1h', label: '1 Hour' },
                    { key: '24h', label: '1 Day' },
                    { key: '3d', label: '3 Days' },
                    { key: '7d', label: '7 Days' },
                    { key: '30d', label: '30 Days' },
                    { key: 'custom', label: 'Custom' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`btn btn-sm ${expirationOption === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setExpirationOption(opt.key as any)}
                      style={{ fontSize: '0.72rem', padding: '0.35rem 0.25rem' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {expirationOption === 'custom' && (
                  <input
                    type="datetime-local"
                    className="input"
                    value={customExpiresAt}
                    onChange={(e) => setCustomExpiresAt(e.target.value)}
                    style={{ marginTop: '0.45rem' }}
                    required
                  />
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={
                  isSubmitting ||
                  (shareMethod === 'PANEL' && recipients.length === 0) ||
                  (resourceType === 'FILE' && selectedFiles.length === 0)
                }
              >
                <span>Continue</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
