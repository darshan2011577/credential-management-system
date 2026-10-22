import React, { useState } from 'react';
import { useLicense } from '../../context/license.context.js';
import {
  Award,
  X,
  Copy,
  Check,
  RotateCw,
  Upload,
} from 'lucide-react';

interface LicenseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseStatusModal: React.FC<LicenseStatusModalProps> = ({ isOpen, onClose }) => {
  const {
    status,
    machineId,
    isLoading,
    refreshLicense,
    importLicense,
    selectAndImportFile,
  } = useLicense();

  const [activeTab, setActiveTab] = useState<'info' | 'import'>('info');
  const [pastedJson, setPastedJson] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const handleCopyMachineId = () => {
    if (machineId) {
      navigator.clipboard.writeText(machineId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleFileSelect = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await selectAndImportFile();
      if (res.canceled) {
        setIsSubmitting(false);
        return;
      }
      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'License updated and verified successfully!' });
        setActiveTab('info');
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to apply new license file.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Error importing license' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedJson.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await importLicense(pastedJson.trim());
      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'License updated successfully!' });
        setPastedJson('');
        setActiveTab('info');
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to activate license.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={16} color="var(--success)" />
            <h3 className="modal-title">License & Access Management</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.2rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.35rem', padding: '0.75rem 1.15rem 0', background: 'var(--bg-surface)' }}>
          <button
            className={`btn btn-sm ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('info')}
          >
            License Status
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('import')}
          >
            Import / Renew License
          </button>
        </div>

        <div className="modal-body">
          {/* Feedback message */}
          {feedback && (
            <div
              style={{
                background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${feedback.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                color: feedback.type === 'success' ? '#34d399' : '#f87171',
                fontSize: '0.8rem',
              }}
            >
              {feedback.text}
            </div>
          )}

          {activeTab === 'info' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Status Summary Banner */}
              <div
                style={{
                  background: status?.isValid ? 'var(--bg-surface)' : 'var(--danger-bg)',
                  border: `1px solid ${status?.isValid ? 'var(--border-default)' : 'var(--danger-border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    License Status
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: status?.isValid ? 'var(--success)' : 'var(--danger)' }}>
                    {status?.status || 'UNKNOWN'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Access Remaining
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {status?.daysRemaining ?? 0} Days
                  </div>
                </div>
              </div>

              {/* Payload Attributes Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.65rem',
                  background: 'var(--bg-input)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Licensed Organization</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{status?.organization || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>License ID</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {status?.licenseId || 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Issued Date</span>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {status?.issuedAt ? new Date(status.issuedAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expiration Date</span>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Machine Fingerprint Box */}
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
                  Device ID
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-input)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {machineId || 'Hardware Locked'}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleCopyMachineId}
                    style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                  >
                    {copiedId ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                    {copiedId ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Native File Selector */}
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFileSelect}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '0.75rem', justifyContent: 'center' }}
                >
                  <Upload size={15} />
                  Choose License File from Computer
                </button>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>— OR PASTE LICENSE CODE —</div>

              {/* Paste JSON */}
              <form onSubmit={handlePasteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Paste license code here..."
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting || !pastedJson.trim()}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {isSubmitting ? 'Verifying...' : 'Activate License'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {activeTab === 'info' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => refreshLicense(true)}
              disabled={isLoading}
            >
              <RotateCw size={13} className={isLoading ? 'spin' : ''} />
              Re-Verify
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
