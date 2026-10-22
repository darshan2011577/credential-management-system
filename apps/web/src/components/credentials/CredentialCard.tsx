import React, { useState } from 'react';
import { ICredentialListItem } from '@credential-manager/types';
import { revealCredential, updateCredential } from '../../services/credential.api.js';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Star,
  ExternalLink,
  Edit2,
  Trash2,
  Lock,
  Globe,
  User,
  Calendar,
  Share2,
} from 'lucide-react';

interface CredentialCardProps {
  credential: ICredentialListItem;
  onEdit: (credential: ICredentialListItem) => void;
  onDelete: (credential: ICredentialListItem) => void;
  onFavoriteToggled: (updated: ICredentialListItem) => void;
  onShare?: (credential: ICredentialListItem) => void;
}

export const CredentialCard: React.FC<CredentialCardProps> = ({
  credential,
  onEdit,
  onDelete,
  onFavoriteToggled,
  onShare,
}) => {
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<boolean>(false);

  const handleToggleReveal = async () => {
    if (revealedPassword !== null) {
      setRevealedPassword(null);
      return;
    }

    setIsRevealing(true);
    try {
      const data = await revealCredential(credential.id);
      setRevealedPassword(data.password);
    } catch (err) {
      console.error('Failed to reveal credential:', err);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(credential.username);
    setCopiedField('username');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyPassword = async () => {
    let passwordToCopy = revealedPassword;
    if (!passwordToCopy) {
      setIsRevealing(true);
      try {
        const data = await revealCredential(credential.id);
        passwordToCopy = data.password;
      } catch (err) {
        console.error('Failed to reveal for copying:', err);
        setIsRevealing(false);
        return;
      }
      setIsRevealing(false);
    }

    if (passwordToCopy) {
      navigator.clipboard.writeText(passwordToCopy);
      setCopiedField('password');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      const data = await updateCredential(credential.id, {
        favorite: !credential.favorite,
      });
      onFavoriteToggled(data.credential);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const formattedDate = new Date(credential.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.85rem',
        padding: '1.05rem',
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      {/* Top Header Row */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '0.65rem',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
              {credential.category}
            </span>
            {credential.website && (
              <a
                href={credential.website.startsWith('http') ? credential.website : `https://${credential.website}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
                title={`Visit ${credential.website}`}
              >
                <Globe size={11} />
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {credential.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                </span>
                <ExternalLink size={9} />
              </a>
            )}
          </div>

          <button
            onClick={handleToggleFavorite}
            disabled={isTogglingFavorite}
            title={credential.favorite ? 'Unmark Favorite' : 'Mark as Favorite'}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.15rem 0.3rem' }}
          >
            <Star
              size={15}
              fill={credential.favorite ? '#facc15' : 'transparent'}
              color={credential.favorite ? '#facc15' : 'var(--text-muted)'}
            />
          </button>
        </div>

        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-primary)' }}>
          {credential.title}
        </h4>

        {/* Credentials Details Box */}
        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.8rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Username Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
              <User size={12} />
              <span>User:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {credential.username}
              </span>
              <button
                onClick={handleCopyUsername}
                title="Copy username"
                className="btn btn-ghost btn-sm"
                style={{ padding: '1px 3px' }}
              >
                {copiedField === 'username' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Password Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
              <Lock size={12} />
              <span>Pass:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  letterSpacing: revealedPassword ? '0px' : '1.5px',
                  color: revealedPassword ? 'var(--info)' : 'var(--text-muted)',
                }}
              >
                {isRevealing ? 'Loading...' : revealedPassword || '••••••••••••'}
              </span>
              <button
                onClick={handleToggleReveal}
                disabled={isRevealing}
                title={revealedPassword ? 'Hide Password' : 'Show Password'}
                className="btn btn-ghost btn-sm"
                style={{ padding: '1px 3px' }}
              >
                {revealedPassword ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                onClick={handleCopyPassword}
                disabled={isRevealing}
                title="Copy Password"
                className="btn btn-ghost btn-sm"
                style={{ padding: '1px 3px' }}
              >
                {copiedField === 'password' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* Notes Preview if available */}
        {credential.notes && (
          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-hover)',
              padding: '0.35rem 0.55rem',
              borderRadius: 'var(--radius-xs)',
              marginTop: '0.5rem',
              lineHeight: '1.35',
              maxHeight: '40px',
              overflowY: 'auto',
            }}
          >
            {credential.notes}
          </div>
        )}
      </div>

      {/* Footer & Actions */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <Calendar size={10} />
          {formattedDate}
        </span>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {onShare && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onShare(credential)}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', color: '#c084fc' }}
              title="Share Credential"
            >
              <Share2 size={11} />
              Share
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(credential)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
            title="Edit Credential"
          >
            <Edit2 size={11} />
            Edit
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(credential)}
            style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
            title="Delete Credential"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
