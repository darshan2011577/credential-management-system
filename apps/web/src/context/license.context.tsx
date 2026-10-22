import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ILicenseValidationResult } from '@credential-manager/types';
import {
  fetchLicenseStatus,
  importLicenseData,
  getMachineIdentifier,
  selectLicenseFileNative,
} from '../services/license.api.js';

export interface LicenseContextValue {
  status: ILicenseValidationResult | null;
  isLoading: boolean;
  error: string | null;
  machineId: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  refreshLicense: (force?: boolean) => Promise<ILicenseValidationResult | null>;
  importLicense: (rawContent: string) => Promise<{ success: boolean; message: string; error?: string }>;
  selectAndImportFile: () => Promise<{ success: boolean; message?: string; error?: string; canceled?: boolean }>;
  clearError: () => void;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ILicenseValidationResult | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLicense = useCallback(async (force: boolean = false): Promise<ILicenseValidationResult | null> => {
    setIsLoading(true);
    try {
      const result = await fetchLicenseStatus(force);
      setStatus(result);
      setError(null);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify application license';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch machine fingerprint and initial license status on startup
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const id = await getMachineIdentifier();
        if (isMounted) setMachineId(id);
      } catch {}

      if (isMounted) {
        await refreshLicense();
      }
    }

    init();

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      refreshLicense(false);
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshLicense]);

  const handleImportLicense = async (
    rawContent: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await importLicenseData(rawContent);
      setStatus(res.status);
      return { success: true, message: res.message || 'License imported successfully' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import license';
      setError(msg);
      return { success: false, message: '', error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAndImportFile = async (): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    canceled?: boolean;
  }> => {
    try {
      const fileRes = await selectLicenseFileNative();
      if (fileRes.canceled || !fileRes.content) {
        return { success: false, canceled: true };
      }

      const importRes = await handleImportLicense(fileRes.content);
      return {
        success: importRes.success,
        message: importRes.message,
        error: importRes.error,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      return { success: false, error: msg };
    }
  };

  const isExpired = Boolean(
    status &&
      (!status.isValid ||
        status.status === 'EXPIRED' ||
        status.status === 'TAMPERED' ||
        status.status === 'INVALID' ||
        status.status === 'CLOCK_SUSPICIOUS' ||
        status.status === 'OFFLINE_EXCEEDED' ||
        status.status === 'NOT_FOUND')
  );

  const isExpiringSoon = Boolean(status?.isValid && status.status === 'EXPIRING_SOON');

  const clearError = () => setError(null);

  return (
    <LicenseContext.Provider
      value={{
        status,
        isLoading,
        error,
        machineId,
        isExpired,
        isExpiringSoon,
        refreshLicense,
        importLicense: handleImportLicense,
        selectAndImportFile: handleSelectAndImportFile,
        clearError,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
};

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
