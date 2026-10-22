import React, { useState } from 'react';
import { ICredentialListItem } from '@credential-manager/types';
import { deleteCredential } from '../../services/credential.api.js';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteCredentialModalProps {
  credential: ICredentialListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (deletedId: string) => void;
}

export const DeleteCredentialModal: React.FC<DeleteCredentialModalProps> = ({
  credential,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !credential) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteCredential(credential.id);
      onDeleted(credential.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting credential.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <h3 className="modal-title" style={{ color: '#fca5a5' }}>
              Delete Credential
            </h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.2rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{credential.title}</strong>? This action cannot be undone.
          </p>

          {error && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                color: '#fca5a5',
                fontSize: '0.8rem',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 size={13} />
            {loading ? 'Deleting...' : 'Delete Credential'}
          </button>
        </div>
      </div>
    </div>
  );
};
