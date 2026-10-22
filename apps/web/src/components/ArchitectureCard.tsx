import React from 'react';
import { HealthResponse } from '@credential-manager/types';
import { Monitor, Layers, ShieldCheck, Database, Zap, HardDrive, CheckCircle, AlertCircle } from 'lucide-react';


interface ArchitectureCardProps {
  isElectron: boolean;
  apiConnected: boolean;
  health?: HealthResponse | null;
}

export const ArchitectureCard: React.FC<ArchitectureCardProps> = ({ isElectron, apiConnected, health }) => {
  const mongoStatus = health?.dependencies?.mongodb?.status ?? 'disconnected';
  const mongoDbName = health?.dependencies?.mongodb?.database ?? 'credentialManagementSystem';
  const mongoPing = health?.dependencies?.mongodb?.pingMs;

  const redisStatus = health?.dependencies?.redis?.status ?? 'disconnected';
  const redisPing = health?.dependencies?.redis?.pingMs;

  const getStatusBadge = (status: string, pingMs?: number, label?: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="badge badge-success">
            <span className="pulse-dot" />
            {label ? `${label} (Online)` : 'Connected'} {pingMs !== undefined ? `• ${pingMs}ms` : ''}
          </span>
        );
      case 'connecting':
        return (
          <span className="badge badge-warning">
            <span className="pulse-dot" />
            Connecting...
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-danger">
            <AlertCircle size={13} />
            Degraded / Error
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="badge badge-warning">
            Offline / Standby
          </span>
        );
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <Layers className="card-title-icon" size={18} color="var(--primary)" />
          <h2 className="card-title">Desktop Architecture & Security Boundary</h2>
        </div>
        <span className="badge badge-success">
          <ShieldCheck size={13} />
          Zero Backend Hosting
        </span>
      </div>

      <div className="arch-flow">
        {/* Node 1: Electron Host Window */}
        <div className="arch-node">
          <div className="arch-node-info">
            <Monitor size={18} color="var(--info)" />
            <div>
              <div className="arch-node-name">Windows Desktop Host (Electron Shell)</div>
              <div className="arch-node-sub">Context Isolated • Secure Preload IPC • Spawns Local API</div>
            </div>
          </div>
          <span className={`badge ${isElectron ? 'badge-success' : 'badge-warning'}`}>
            <span className="pulse-dot" />
            {isElectron ? 'Electron Active' : 'Browser Dev Mode'}
          </span>
        </div>

        {/* Node 2: React Renderer */}
        <div className="arch-node">
          <div className="arch-node-info">
            <HardDrive size={18} color="var(--purple)" />
            <div>
              <div className="arch-node-name">React + Vite Frontend (UI Renderer)</div>
              <div className="arch-node-sub">TypeScript • Modern CSS • Zero Direct DB/Secrets Access</div>
            </div>
          </div>
          <span className="badge badge-success">
            <CheckCircle size={13} />
            Render Ready
          </span>
        </div>

        {/* Node 3: Local Express API */}
        <div className="arch-node">
          <div className="arch-node-info">
            <Layers size={18} color="var(--primary)" />
            <div>
              <div className="arch-node-name">Local Express REST API</div>
              <div className="arch-node-sub">Bound to 127.0.0.1:5000 • Helmet & Rate Limiting • Phase 3</div>
            </div>
          </div>
          <span className={`badge ${apiConnected ? 'badge-success' : 'badge-warning'}`}>
            <span className="pulse-dot" />
            {apiConnected ? '127.0.0.1:5000 (Online)' : 'Connecting...'}
          </span>
        </div>

        {/* Node 4: MongoDB Atlas (Cloud) */}
        <div className="arch-node">
          <div className="arch-node-info">
            <Database size={18} color="var(--success)" />
            <div>
              <div className="arch-node-name">MongoDB Atlas (Primary Cloud DB)</div>
              <div className="arch-node-sub">Mongoose 8 • TLS Pool • DB: [{mongoDbName}]</div>
            </div>
          </div>
          {getStatusBadge(mongoStatus, mongoPing, 'Atlas Cloud')}
        </div>

        {/* Node 5: Redis (High-speed temporary cache) */}
        <div className="arch-node">
          <div className="arch-node-info">
            <Zap size={18} color="var(--warning)" />
            <div>
              <div className="arch-node-name">Redis (Cache & Rate Limiter)</div>
              <div className="arch-node-sub">ioredis • 127.0.0.1:6379 • Resilient Failover</div>
            </div>
          </div>
          {getStatusBadge(redisStatus, redisPing, 'Local Redis')}
        </div>
      </div>
    </div>
  );
};

