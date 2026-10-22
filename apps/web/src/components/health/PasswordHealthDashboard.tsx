import React, { useEffect, useState, useMemo } from 'react';
import {
  PasswordHealthDetailsResponse,
  PasswordHealthResult,
  PasswordHealthStatus,
  PasswordStrengthLevel,
  ICredentialListItem,
} from '@credential-manager/types';
import { fetchCredentialHealthList } from '../../services/password-health.api.js';
import { fetchCredentials } from '../../services/credential.api.js';
import { EditCredentialModal } from '../credentials/EditCredentialModal.js';
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Lock,
  Clock,
  CopyCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Globe,
  Edit2,
} from 'lucide-react';

type HealthFilter = 'ALL' | 'NEEDS_ATTENTION' | 'WEAK' | 'REUSED' | 'OLD' | 'HEALTHY';
type HealthSort = 'WORST_SCORE' | 'BEST_SCORE' | 'OLDEST_PASSWORD' | 'NAME_ASC';

interface PasswordHealthDashboardProps {
  onNavigateToVault?: () => void;
}

export const PasswordHealthDashboard: React.FC<PasswordHealthDashboardProps> = ({
  onNavigateToVault,
}) => {
  const [data, setData] = useState<PasswordHealthDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HealthFilter>('ALL');
  const [sortOption, setSortOption] = useState<HealthSort>('WORST_SCORE');

  // Edit Modal Integration for "Improve Password" Action
  const [editingCredential, setEditingCredential] = useState<ICredentialListItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const loadHealthData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCredentialHealthList();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze password health.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealthData();
  }, []);

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    if (!data || !data.items) return [];

    let list = [...data.items];

    if (activeFilter === 'NEEDS_ATTENTION') {
      list = list.filter((item) => item.issues.length > 0 || item.score < 80);
    } else if (activeFilter === 'WEAK') {
      list = list.filter(
        (item) => item.strength === 'WEAK' || item.strength === 'VERY_WEAK'
      );
    } else if (activeFilter === 'REUSED') {
      list = list.filter((item) => item.reused);
    } else if (activeFilter === 'OLD') {
      list = list.filter((item) => item.ageStatus === 'OLD' || item.ageStatus === 'CRITICAL');
    } else if (activeFilter === 'HEALTHY') {
      list = list.filter((item) => item.issues.length === 0 && item.score >= 80);
    }

    list.sort((a, b) => {
      if (sortOption === 'WORST_SCORE') return a.score - b.score;
      if (sortOption === 'BEST_SCORE') return b.score - a.score;
      if (sortOption === 'OLDEST_PASSWORD') return b.passwordAgeDays - a.passwordAgeDays;
      if (sortOption === 'NAME_ASC') return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
  }, [data, activeFilter, sortOption]);

  const handleImprovePassword = async (item: PasswordHealthResult) => {
    try {
      const vaultResult = await fetchCredentials({ search: item.title, limit: 50 });
      const found = vaultResult.items.find((c) => c.id === item.credentialId);
      if (found) {
        setEditingCredential(found);
        setIsEditModalOpen(true);
      } else {
        setEditingCredential({
          id: item.credentialId,
          ownerId: '',
          title: item.title,
          website: item.website,
          username: item.username,
          category: item.category,
          favorite: false,
          createdAt: item.analyzedAt,
          updatedAt: item.analyzedAt,
        });
        setIsEditModalOpen(true);
      }
    } catch {
      setEditingCredential({
        id: item.credentialId,
        ownerId: '',
        title: item.title,
        website: item.website,
        username: item.username,
        category: item.category,
        favorite: false,
        createdAt: item.analyzedAt,
        updatedAt: item.analyzedAt,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleCredentialUpdated = () => {
    setIsEditModalOpen(false);
    setEditingCredential(null);
    loadHealthData();
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Analyzing Password Health...</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Checking password strength, reuse, and age across your saved credentials...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--danger-border)' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 0.75rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fca5a5', marginBottom: '0.35rem' }}>
          Unable to Analyze Password Health
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
          {error || 'An unexpected error occurred during password health analysis.'}
        </p>
        <button className="btn btn-primary btn-sm" onClick={loadHealthData}>
          <RefreshCw size={13} /> Retry Analysis
        </button>
      </div>
    );
  }

  const { summary } = data;

  if (summary.totalCredentials === 0) {
    return (
      <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
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
            margin: '0 auto 0.85rem',
            border: '1px solid var(--info-border)',
          }}
        >
          <Lock size={24} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          No Credentials to Analyze
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto 1.25rem', lineHeight: '1.5' }}>
          Save credentials to monitor their strength, find reused passwords, and keep your accounts secure.
        </p>
        {onNavigateToVault && (
          <button className="btn btn-primary btn-sm" onClick={onNavigateToVault}>
            <Sparkles size={14} /> Go to My Credentials
          </button>
        )}
      </div>
    );
  }

  const getStatusBadge = (status: PasswordHealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="badge badge-success">HEALTHY</span>;
      case 'NEEDS_ATTENTION':
        return <span className="badge badge-warning">NEEDS ATTENTION</span>;
      case 'AT_RISK':
        return <span className="badge badge-danger">AT RISK</span>;
      case 'CRITICAL':
        return <span className="badge badge-danger">CRITICAL RISK</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const getStrengthBadge = (strength: PasswordStrengthLevel, score: number) => {
    switch (strength) {
      case 'VERY_STRONG':
      case 'STRONG':
        return <span className="badge badge-success">{strength.replace('_', ' ')} ({score}/100)</span>;
      case 'MEDIUM':
        return <span className="badge badge-warning">Medium ({score}/100)</span>;
      case 'WEAK':
      case 'VERY_WEAK':
        return <span className="badge badge-danger">{strength.replace('_', ' ')} ({score}/100)</span>;
      default:
        return <span className="badge badge-neutral">{strength}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Overall Security Score Panel */}
      <div className="card" style={{ padding: '1.25rem 1.35rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Left Score Gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-md)',
                background: summary.score >= 80 ? 'var(--success-bg)' : summary.score >= 60 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                border: `1px solid ${summary.score >= 80 ? 'var(--success-border)' : summary.score >= 60 ? 'var(--warning-border)' : 'var(--danger-border)'}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: summary.score >= 80 ? 'var(--success)' : summary.score >= 60 ? 'var(--warning)' : 'var(--danger)',
                  lineHeight: '1',
                }}
              >
                {summary.score}
              </span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Your Password Health
                </h3>
                {getStatusBadge(summary.status)}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {summary.status === 'HEALTHY'
                  ? 'All saved passwords meet strong security and uniqueness recommendations.'
                  : 'We recommend updating weak, reused, or older passwords to improve your score.'}
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadHealthData}
            title="Refresh health analysis"
          >
            <RefreshCw size={13} /> Refresh Health
          </button>
        </div>

        {/* Metric Counter Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.65rem',
            marginTop: '0.85rem',
          }}
        >
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Passwords</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.totalCredentials}</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 600 }}>Healthy</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--success)' }}>{summary.healthyCredentials}</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: summary.weakCredentials > 0 ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Weak</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: summary.weakCredentials > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{summary.weakCredentials}</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: summary.reusedCredentials > 0 ? 'var(--warning)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Reused</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: summary.reusedCredentials > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{summary.reusedCredentials}</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: summary.oldCredentials > 0 ? 'var(--warning)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Older Passwords</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: summary.oldCredentials > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{summary.oldCredentials}</div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', color: summary.policyViolations > 0 ? 'var(--purple)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Recommendations</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: summary.policyViolations > 0 ? 'var(--purple)' : 'var(--text-primary)' }}>{summary.policyViolations}</div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar & Sort Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {(['ALL', 'NEEDS_ATTENTION', 'WEAK', 'REUSED', 'OLD', 'HEALTHY'] as HealthFilter[]).map((filter) => (
            <button
              key={filter}
              className={`btn btn-sm ${activeFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter(filter)}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
            >
              {filter === 'ALL'
                ? `All (${summary.totalCredentials})`
                : filter === 'NEEDS_ATTENTION'
                  ? `Needs Attention (${summary.totalCredentials - summary.healthyCredentials})`
                  : filter === 'WEAK'
                    ? `Weak (${summary.weakCredentials})`
                    : filter === 'REUSED'
                      ? `Reused (${summary.reusedCredentials})`
                      : filter === 'OLD'
                        ? `Old (${summary.oldCredentials})`
                        : `Healthy (${summary.healthyCredentials})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sort:</span>
          <select
            className="select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as HealthSort)}
            style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem', width: 'auto' }}
          >
            <option value="WORST_SCORE">Needs Attention First</option>
            <option value="BEST_SCORE">Healthy First</option>
            <option value="OLDEST_PASSWORD">Oldest First</option>
            <option value="NAME_ASC">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 3. Filtered Credential Health Cards */}
      {filteredItems.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={28} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            No Credentials in This Filter
          </h4>
          <p style={{ fontSize: '0.78rem' }}>None of your credentials match the active filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map((item) => {
            const hasIssues = item.issues.length > 0 || item.score < 80;

            return (
              <div
                key={item.credentialId}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  borderColor: hasIssues ? 'var(--border-default)' : 'var(--border-default)',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.65rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.title}
                      </h4>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                        {item.category}
                      </span>
                      {item.website && (
                        <a
                          href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                          }}
                        >
                          <Globe size={11} />
                          <span>{item.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</span>
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Account: {item.username}
                    </div>
                  </div>

                  {/* Badges & Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStrengthBadge(item.strength, item.strengthScore)}

                    <span
                      className={`badge ${item.score >= 80 ? 'badge-success' : item.score >= 60 ? 'badge-warning' : 'badge-danger'}`}
                      style={{ fontWeight: 700 }}
                    >
                      Health: {item.score}/100
                    </span>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleImprovePassword(item)}
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      title="Change Password"
                    >
                      <Edit2 size={11} />
                      Change
                    </button>
                  </div>
                </div>

                {/* Characteristics Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span
                    className={`badge ${item.ageStatus === 'CRITICAL' ? 'badge-danger' : item.ageStatus === 'OLD' ? 'badge-warning' : 'badge-neutral'}`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    <Clock size={11} />
                    {item.passwordAgeDays === 0 ? 'Updated today' : `Updated ${item.passwordAgeDays}d ago`}
                  </span>

                  <span
                    className={`badge ${item.policyCompliant ? 'badge-success' : 'badge-danger'}`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {item.policyCompliant ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {item.policyCompliant ? 'Meets Guidelines' : 'Needs Attention'}
                  </span>

                  {item.reused ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                      <CopyCheck size={11} />
                      Reused in {item.reuseCount} accounts
                    </span>
                  ) : (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={11} />
                      Unique Password
                    </span>
                  )}
                </div>

                {/* Issues if any */}
                {hasIssues && item.issues.length > 0 && (
                  <div
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#fca5a5',
                    }}
                  >
                    {item.issues.map((iss, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                        <span>{typeof iss === 'string' ? iss : iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Credential Modal */}
      {isEditModalOpen && (
        <EditCredentialModal
          credential={editingCredential}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingCredential(null);
          }}
          onUpdated={handleCredentialUpdated}
        />
      )}
    </div>
  );
};
