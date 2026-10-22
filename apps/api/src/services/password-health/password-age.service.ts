import { PasswordAgeStatus } from '@credential-manager/types';
import { PASSWORD_HEALTH_CONFIG } from '@credential-manager/config';

export interface PasswordAgeAnalysis {
  ageDays: number;
  ageStatus: PasswordAgeStatus;
}

export class PasswordAgeService {
  /**
   * Calculates password age in days and classifies it into NORMAL, OLD, or CRITICAL.
   * Handles missing passwordChangedAt gracefully by falling back to createdAt or current time.
   */
  public static analyze(
    passwordChangedAt?: Date | string,
    createdAt?: Date | string
  ): PasswordAgeAnalysis {
    const targetDate = passwordChangedAt
      ? new Date(passwordChangedAt)
      : createdAt
      ? new Date(createdAt)
      : new Date();

    const timestamp = isNaN(targetDate.getTime()) ? Date.now() : targetDate.getTime();
    const diffMs = Math.max(0, Date.now() - timestamp);
    const ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let ageStatus: PasswordAgeStatus = 'NORMAL';
    if (ageDays >= PASSWORD_HEALTH_CONFIG.criticalAgeDays) {
      ageStatus = 'CRITICAL';
    } else if (ageDays >= PASSWORD_HEALTH_CONFIG.oldAgeDays) {
      ageStatus = 'OLD';
    }

    return {
      ageDays,
      ageStatus,
    };
  }
}
