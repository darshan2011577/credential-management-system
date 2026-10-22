import React, { useState, useEffect, useCallback } from 'react';
import { CredentialCategory, ICredentialListItem } from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';
import { fetchCredentials } from '../../services/credential.api.js';
import { CredentialCard } from './CredentialCard.js';
import { AddCredentialModal } from './AddCredentialModal.js';
import { EditCredentialModal } from './EditCredentialModal.js';
import { DeleteCredentialModal } from './DeleteCredentialModal.js';
import { ShareCredentialModal } from '../sharing/ShareCredentialModal.js';
import {
  KeyRound,
  Plus,
  Search,
  Star,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FolderLock,
} from 'lucide-react';

export const CredentialVaultView: React.FC = () => {
  const [credentials, setCredentials] = useState<ICredentialListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modals State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCredential, setEditingCredential] = useState<ICredentialListItem | null>(null);
  const [deletingCredential, setDeletingCredential] = useState<ICredentialListItem | null>(null);
  const [sharingCredential, setSharingCredential] = useState<ICredentialListItem | null>(null);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCredentials({
        page: currentPage,
        limit: 12,
        search: searchTerm.trim() || undefined,
        category: selectedCategory !== 'ALL' ? (selectedCategory as CredentialCategory) : undefined,
        favorite: favoritesOnly ? true : undefined,
      });

      setCredentials(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading credentials.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedCategory, favoritesOnly]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleCreated = (newCred: ICredentialListItem) => {
    setCredentials((prev) => [newCred, ...prev]);
    setTotalCount((prev) => prev + 1);
  };

  const handleUpdated = (updated: ICredentialListItem) => {
    setCredentials((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleted = (deletedId: string) => {
    setCredentials((prev) => prev.filter((c) => c.id !== deletedId));
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Action Header & Search Filter Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          padding: '1.15rem 1.35rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--info-border)',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  My Credentials
                </h3>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                  {totalCount} Saved
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Keep your account information organized and securely protected.
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} />
            Add Credential
          </button>
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr auto auto',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.7rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search by title, website, or username..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.1rem', fontSize: '0.82rem' }}
            />
          </div>

          {/* Category Selector */}
          <select
            className="select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem' }}
          >
            <option value="ALL">All Categories</option>
            {CREDENTIAL_CONFIG.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Favorites Filter Toggle */}
          <button
            className={`btn btn-sm ${favoritesOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFavoritesOnly(!favoritesOnly);
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.78rem' }}
          >
            <Star size={13} fill={favoritesOnly ? '#facc15' : 'transparent'} color={favoritesOnly ? '#facc15' : 'currentColor'} />
            Favorites
          </button>

          {/* Refresh Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadCredentials}
            disabled={loading}
            title="Refresh Vault"
            style={{ padding: '0.4rem 0.6rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#fca5a5', fontSize: '0.84rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={loadCredentials}>
            Retry
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '220px',
            gap: '0.5rem',
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw size={24} className="spin" color="var(--primary)" />
          <span style={{ fontSize: '0.82rem' }}>
            Loading credentials...
          </span>
        </div>
      ) : credentials.length === 0 ? (
        /* Empty State */
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '3rem 1.5rem',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--info-bg)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.85rem',
              border: '1px solid var(--info-border)',
            }}
          >
            <FolderLock size={24} />
          </div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {searchTerm || selectedCategory !== 'ALL' || favoritesOnly
              ? 'No matching credentials found'
              : "You haven't added any credentials yet."}
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            {searchTerm || selectedCategory !== 'ALL' || favoritesOnly
              ? 'Try modifying your search query or removing the category filter.'
              : 'Save and organize passwords, logins, and service accounts in one secure place.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add Credential
          </button>
        </div>
      ) : (
        /* Credentials Card Grid */
        <div className="grid-3">
          {credentials.map((cred) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              onEdit={(target) => setEditingCredential(target)}
              onDelete={(target) => setDeletingCredential(target)}
              onFavoriteToggled={handleUpdated}
              onShare={(target) => setSharingCredential(target)}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1rem',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddCredentialModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleCreated}
      />

      <EditCredentialModal
        credential={editingCredential}
        isOpen={Boolean(editingCredential)}
        onClose={() => setEditingCredential(null)}
        onUpdated={handleUpdated}
      />

      <DeleteCredentialModal
        credential={deletingCredential}
        isOpen={Boolean(deletingCredential)}
        onClose={() => setDeletingCredential(null)}
        onDeleted={handleDeleted}
      />

      <ShareCredentialModal
        credential={sharingCredential}
        isOpen={Boolean(sharingCredential)}
        onClose={() => setSharingCredential(null)}
      />
    </div>
  );
};
