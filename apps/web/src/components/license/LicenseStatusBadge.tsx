import React, { useState } from 'react';
import { useLicense } from '../../context/license.context.js';
import { LicenseStatusModal } from './LicenseStatusModal.js';
import { Award } from 'lucide-react';

export const LicenseStatusBadge: React.FC<{ className?: string }> = () => {
  const { status, isExpiringSoon, isExpired } = useLicense();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!status) return null;

  const daysRemaining = status.daysRemaining ?? 0;

  const getBadgeClass = () => {
    if (isExpired) return 'badge-danger';
    if (isExpiringSoon) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`badge ${getBadgeClass()}`}
        style={{ cursor: 'pointer', border: 'none', background: undefined }}
        title="View License Status & Management"
      >
        <Award size={11} />
        <span>
          {isExpired
            ? 'License Expired'
            : isExpiringSoon
              ? `Expiring: ${daysRemaining}d`
              : `License: ${daysRemaining}d`}
        </span>
      </button>

      {isModalOpen && (
        <LicenseStatusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};
