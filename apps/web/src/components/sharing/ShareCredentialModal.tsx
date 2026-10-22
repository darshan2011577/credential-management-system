import React from 'react';
import { ICredentialListItem } from '@credential-manager/types';
import { ShareModal } from './ShareModal.js';

interface ShareCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  credential: ICredentialListItem | null;
  onShareCreated?: () => void;
}

export const ShareCredentialModal: React.FC<ShareCredentialModalProps> = ({
  isOpen,
  onClose,
  credential,
  onShareCreated,
}) => {
  return (
    <ShareModal
      isOpen={isOpen}
      onClose={onClose}
      preselectedCredential={credential}
      onShareCreated={onShareCreated}
    />
  );
};
