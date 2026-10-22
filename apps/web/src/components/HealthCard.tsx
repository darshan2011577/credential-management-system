import React from 'react';
import { HealthResponse } from '@credential-manager/types';
import { Activity, Clock, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface HealthCardProps {
  health: HealthResponse | null;
  loading: boolean;
  error?: string;
  latencyMs: number;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const HealthCard: React.FC<HealthCardProps> = ({
  health,
  loading,
  error,
  latencyMs,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
}) => {
  const isHealthy = Boolean(health && health.status === 'healthy');

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <Activity className="card-title-icon" size={20} />
          <h2 className="card-title">Local API Health Probe</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={onToggleAutoRefresh}
            title="Auto-refresh every 5 seconds"
          >
            <Clock size={14} />
            {autoRefresh ? 'Auto Poll: ON' : 'Auto Poll: OFF'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Status Indicator Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {isHealthy ? (
              <CheckCircle2 size={20} color="#10b981" />
            ) : (
              <AlertCircle size={20} color="#f43f5e" />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isHealthy ? '#34d399' : '#fb7185' }}>
                {isHealthy ? 'Local Express API is Operational' : 'Local Express API Offline / Unreachable'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Target: <span style={{ fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:5000/api/health</span>
              </div>
            </div>
          </div>
          <div className="badge badge-blue">
            <span>{latencyMs}ms Latency</span>
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: '0.8rem',
            padding: '0.75rem',
            background: 'rgba(244, 63, 94, 0.15)',
            color: '#fda4af',
            borderRadius: '6px',
            border: '1px solid rgba(244, 63, 94, 0.3)',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="metric-row">
          <span className="metric-label">Service Name</span>
          <span className="metric-value">{health?.service || 'Credential Management System API'}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">API Version</span>
          <span className="metric-value">v{health?.version || '1.0.0'}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Process Uptime</span>
          <span className="metric-value">{health ? `${health.uptime}s` : '0s'}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Node Runtime</span>
          <span className="metric-value">{health?.system.nodeVersion || 'Node.js v22+'}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Memory Usage</span>
          <span className="metric-value">{health ? `${health.system.memoryUsageMB} MB` : 'N/A'}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Environment</span>
          <span className="badge badge-purple">{health?.environment || 'development'}</span>
        </div>

        {/* Raw Payload Preview */}
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Raw Probe Response Envelope:
          </div>
          <pre className="json-viewer">
            {JSON.stringify(health || { error: error || 'No connection established' }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
