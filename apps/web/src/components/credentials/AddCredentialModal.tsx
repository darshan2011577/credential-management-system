import React, { useState } from 'react';
import { CredentialCategory, ICredentialListItem } from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';
import { createCredential } from '../../services/credential.api.js';
import { PasswordGeneratorModal } from './PasswordGeneratorModal.js';
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface AddCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (credential: ICredentialListItem) => void;
}

export const AddCredentialModal: React.FC<AddCredentialModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<CredentialCategory>('DEVELOPMENT');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !username.trim() || !password.trim()) {
      setError('Title, username, and password are required fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await createCredential({
        title: title.trim(),
        website: website.trim() || undefined,
        username: username.trim(),
        password: password.trim(),
        category,
        notes: notes.trim() || undefined,
        favorite,
      });

      onCreated(data.credential);
      onClose();
      // Reset form
      setTitle('');
      setWebsite('');
      setUsername('');
      setPassword('');
      setCategory('DEVELOPMENT');
      setNotes('');
      setFavorite(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error saving credential.');
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
              <KeyRound size={16} color="var(--info)" />
              <h3 className="modal-title">Add Credential</h3>
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
                    placeholder="e.g. GitHub Workspace"
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
                  placeholder="https://github.com or internal.portal.edu"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label">
                  Username / Email / Account ID <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="employee@college.edu"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {/* Password with Generator Button */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">
                    Password <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
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
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: '2.2rem', fontFamily: 'var(--font-mono)' }}
                    required
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

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Departmental context or recovery codes"
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
                <Plus size={13} />
                {loading ? 'Saving...' : 'Save Credential'}
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
