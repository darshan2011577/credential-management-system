import React, { useState, useEffect } from 'react';
import { CredentialCategory, ICredentialListItem } from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';
import { updateCredential } from '../../services/credential.api.js';
import { PasswordGeneratorModal } from './PasswordGeneratorModal.js';
import {
  Edit2,
  X,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Save,
} from 'lucide-react';

interface EditCredentialModalProps {
  credential: ICredentialListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (credential: ICredentialListItem) => void;
}

export const EditCredentialModal: React.FC<EditCredentialModalProps> = ({
  credential,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [category, setCategory] = useState<CredentialCategory>('DEVELOPMENT');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (credential) {
      setTitle(credential.title);
      setWebsite(credential.website || '');
      setUsername(credential.username);
      setPassword('');
      setChangePassword(false);
      setCategory(credential.category);
      setNotes(credential.notes || '');
      setFavorite(credential.favorite);
      setError(null);
    }
  }, [credential, isOpen]);

  if (!isOpen || !credential) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !username.trim()) {
      setError('Title and username are required.');
      return;
    }
    if (changePassword && !password.trim()) {
      setError('Please enter a new password or uncheck Change Password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        website: website.trim() || undefined,
        username: username.trim(),
        category,
        notes: notes.trim() || undefined,
        favorite,
      };

      if (changePassword && password.trim()) {
        payload.password = password.trim();
      }

      const data = await updateCredential(credential.id, payload);
      onUpdated(data.credential);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error updating credential.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit2 size={16} color="var(--purple)" />
              <h3 className="modal-title">Edit Credential</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.2rem' }}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-body">
              {error && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Title & Category Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Title <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Category <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CredentialCategory)}
                  >
                    {CREDENTIAL_CONFIG.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Website URL */}
              <div className="form-group">
                <label className="form-label">Website / Portal URL</label>
                <input
                  type="text"
                  className="input"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label">
                  Username / Account ID <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {/* Change Password Toggle */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: changePassword ? 'var(--info)' : 'var(--text-secondary)',
                    marginBottom: changePassword ? '0.65rem' : '0',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={changePassword}
                    onChange={(e) => setChangePassword(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>Change Password</span>
                </label>

                {changePassword && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowGenerator(true)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.74rem', padding: '0 0.35rem', color: 'var(--purple)' }}
                      >
                        <Sparkles size={12} />
                        Generate Strong
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input"
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '2.2rem', fontFamily: 'var(--font-mono)' }}
                        required={changePassword}
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
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Use a strong and unique password for better security.
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Favorite Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Mark as Favorite</span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                <Save size={13} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PasswordGeneratorModal
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onApply={(gen) => setPassword(gen)}
      />
    </>
  );
};
