import React, { useState } from 'react';
import { useLicense } from '../../context/license.context.js';
import { LicenseStatusModal } from './LicenseStatusModal.js';
import {
  AlertTriangle,
  Upload,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    status,
    isLoading,
    machineId,
    isExpired,
    isExpiringSoon,
    refreshLicense,
    importLicense,
    selectAndImportFile,
    clearError,
  } = useLicense();

  const [pastedContent, setPastedContent] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [dismissWarning, setDismissWarning] = useState(false);

  const handleCopyMachineId = () => {
    if (machineId) {
      navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      setTimeout(() => setCopiedMachineId(false), 2000);
    }
  };

  const handleNativeFileSelect = async () => {
    setIsSubmitting(true);
    setImportMessage(null);
    clearError();
    try {
      const res = await selectAndImportFile();
      if (res.canceled) {
        setIsSubmitting(false);
        return;
      }
      if (res.success) {
        setImportMessage({ type: 'success', text: res.message || 'License activated successfully!' });
      } else {
        setImportMessage({ type: 'error', text: res.error || 'Failed to activate selected license.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: err instanceof Error ? err.message : 'File import failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
          setIsSubmitting(true);
          setImportMessage(null);
          const res = await importLicense(content);
          if (res.success) {
            setImportMessage({ type: 'success', text: res.message });
          } else {
            setImportMessage({ type: 'error', text: res.error || 'Invalid license content.' });
          }
          setIsSubmitting(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedContent.trim()) return;

    setIsSubmitting(true);
    setImportMessage(null);
    clearError();

    const res = await importLicense(pastedContent.trim());
    if (res.success) {
      setImportMessage({ type: 'success', text: res.message });
      setPastedContent('');
      setShowPasteBox(false);
    } else {
      setImportMessage({ type: 'error', text: res.error || 'Failed to activate pasted license.' });
    }
    setIsSubmitting(false);
  };

  // Initial loading state on cold boot
  if (isLoading && !status) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <RotateCw size={28} className="spin" style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>VERIFYING APPLICATION LICENSE...</span>
      </div>
    );
  }

  // Blocking Expired / Tampered / Suspicious Screen
  if (isExpired) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', userSelect: 'none' }}>
        <div className="card" style={{ maxWidth: '580px', width: '100%', padding: '2rem', borderColor: 'var(--danger-border)', background: 'var(--bg-surface-elevated)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <AlertTriangle size={28} color="var(--danger)" />
            </div>

            {/* Friendly Copy */}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Your application access has ended.
            </h1>
            <p style={{ fontSize: '0.92rem', color: '#fca5a5', fontWeight: 500 }}>
              Please contact your administrator to restore access.
            </p>
          </div>

          {/* License Diagnostic Panel */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.78rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge badge-danger">
                {status?.status || 'EXPIRED'}
              </span>
            </div>

            {status?.reason && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{status.reason}</span>
              </div>
            )}

            {status?.expiresAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Expiration Date:</span>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(status.expiresAt).toLocaleDateString()}</span>
              </div>
            )}

            {machineId && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Device ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--warning)' }}>
                    {machineId.slice(0, 14)}...
                  </span>
                  <button
                    onClick={handleCopyMachineId}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '1px 5px', fontSize: '0.7rem' }}
                  >
                    {copiedMachineId ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Feedback message */}
          {importMessage && (
            <div
              style={{
                background: importMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${importMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                color: importMessage.type === 'success' ? '#34d399' : '#f87171',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              {importMessage.text}
            </div>
          )}

          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={handleNativeFileSelect}
            style={{
              border: '2px dashed var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '1.25rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg-surface)',
              marginBottom: '1rem',
            }}
          >
            <Upload size={24} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Select License File (.lic / .json)
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Click to choose a license file from your computer
            </p>
          </div>

          {/* Paste Raw License */}
          <div>
            <button
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '0 0.25rem', marginBottom: '0.5rem' }}
            >
              {showPasteBox ? '— Hide manual input' : '+ Enter license code manually'}
            </button>

            {showPasteBox && (
              <form onSubmit={handlePasteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.35rem' }}>
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste license code here..."
                  rows={3}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !pastedContent.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-end' }}
                >
                  {isSubmitting ? 'Verifying...' : 'Activate License'}
                </button>
              </form>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => refreshLicense(true)}
              disabled={isLoading}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
            >
              <RotateCw size={12} className={isLoading ? 'spin' : ''} />
              Check Status Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active / Valid Application Access
  return (
    <>
      {/* Expiring Soon Banner (< 7 days) */}
      {isExpiringSoon && !dismissWarning && (
        <div
          style={{
            background: 'var(--warning-bg)',
            borderBottom: '1px solid var(--warning-border)',
            color: '#fde68a',
            padding: '0.5rem 1.25rem',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={14} color="var(--warning)" />
            <span>
              <strong>Evaluation Access:</strong> Access expires in{' '}
              <span style={{ fontWeight: 700, textDecoration: 'underline' }}>{status?.daysRemaining} days</span>. Please contact{' '}
              <strong>your administrator</strong> to renew your license.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowRenewModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#fde68a', borderColor: 'var(--warning-border)' }}
            >
              Update License
            </button>
            <button
              onClick={() => setDismissWarning(true)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.1rem 0.35rem', fontSize: '0.85rem' }}
              title="Dismiss warning"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {children}

      {/* License Renewal Modal */}
      {showRenewModal && (
        <LicenseStatusModal isOpen={showRenewModal} onClose={() => setShowRenewModal(false)} />
      )}
    </>
  );
};
