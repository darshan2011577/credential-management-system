import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import {
  ILicensePayload,
  ISignedLicense,
  ILicenseValidationResult,
  LocalLicenseState,
  LicenseStatus,
} from '@credential-manager/types';
import { LICENSE_CONFIG, DEFAULT_SIGNED_LICENSE } from '@credential-manager/config';
import { AuditService } from './audit.service.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export class LicenseService {
  private static cachedResult: ILicenseValidationResult | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 15000; // Cache status in memory for 15s

  /**
   * Derives a stable, non-reversible SHA-256 machine identifier.
   */
  public static getMachineFingerprint(): string {
    try {
      const components = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.release(),
        os.userInfo().username,
      ].join('::');

      return crypto.createHash('sha256').update(components).digest('hex');
    } catch {
      return crypto.createHash('sha256').update('GENERIC_HOST_FALLBACK').digest('hex');
    }
  }

  /**
   * Canonicalizes license payload for deterministic signature verification.
   */
  public static canonicalizePayload(payload: ILicensePayload): string {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(payload).sort();
    for (const k of keys) {
      sorted[k] = (payload as any)[k];
    }
    return JSON.stringify(sorted);
  }

  /**
   * Verifies an Ed25519 asymmetric signature against the embedded public key.
   */
  public static verifySignature(
    signedLicense: ISignedLicense,
    publicKeyPem: string = LICENSE_CONFIG.publicKeyPem
  ): boolean {
    try {
      if (!signedLicense || !signedLicense.payload || !signedLicense.signature) {
        return false;
      }

      const canonical = this.canonicalizePayload(signedLicense.payload);
      const signatureBuffer = Buffer.from(signedLicense.signature, 'base64');
      const dataBuffer = Buffer.from(canonical, 'utf8');

      return crypto.verify(null, dataBuffer, publicKeyPem, signatureBuffer);
    } catch (err) {
      ApiLogger.warn('LicenseService', `Signature verification error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Resolves the OS-level storage directory for active license and validation state.
   */
  public static getLicenseStorageDir(): string {
    let baseDir = process.env.APPDATA || (
      process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.config')
    );

    const storageDir = path.join(baseDir, 'CredentialManager');
    if (!fs.existsSync(storageDir)) {
      try {
        fs.mkdirSync(storageDir, { recursive: true });
      } catch {
        // Fallback to local working directory if AppData is not writable
        return process.cwd();
      }
    }
    return storageDir;
  }

  public static getLicenseFilePath(): string {
    return path.join(this.getLicenseStorageDir(), LICENSE_CONFIG.licenseFileName);
  }

  public static getStateFilePath(): string {
    return path.join(this.getLicenseStorageDir(), LICENSE_CONFIG.stateFileName);
  }

  /**
   * Loads local time validation state.
   */
  public static loadLocalState(): LocalLicenseState {
    const statePath = this.getStateFilePath();
    try {
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      // Ignore corrupt state and start fresh
    }

    const nowIso = new Date().toISOString();
    return {
      lastTrustedTime: nowIso,
      lastSuccessfulValidation: nowIso,
      lastLocalTime: nowIso,
    };
  }

  /**
   * Persists local time validation state safely.
   */
  public static saveLocalState(state: LocalLicenseState): void {
    const statePath = this.getStateFilePath();
    try {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      ApiLogger.warn('LicenseService', `Failed to persist license state: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Fetches current UTC time from a trusted public HTTPS endpoint.
   */
  public static async fetchTrustedNetworkTime(timeoutMs: number = 3000): Promise<Date | null> {
    for (const endpoint of LICENSE_CONFIG.trustedTimeEndpoints) {
      try {
        const time = await new Promise<Date | null>((resolve) => {
          const req = https.request(
            endpoint,
            { method: 'HEAD', timeout: timeoutMs },
            (res) => {
              const dateHeader = res.headers.date;
              if (dateHeader) {
                const parsed = new Date(dateHeader);
                if (!isNaN(parsed.getTime())) {
                  resolve(parsed);
                  return;
                }
              }
              resolve(null);
            }
          );

          req.on('timeout', () => {
            req.destroy();
            resolve(null);
          });

          req.on('error', () => {
            resolve(null);
          });

          req.end();
        });

        if (time) {
          return time;
        }
      } catch {
        // Try next fallback endpoint
      }
    }

    return null;
  }

  /**
   * Reads active signed license file from storage or falls back to default.
   */
  public static loadActiveLicense(): ISignedLicense {
    const licPath = this.getLicenseFilePath();
    try {
      if (fs.existsSync(licPath)) {
        const raw = fs.readFileSync(licPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.payload && parsed.signature) {
          return parsed as ISignedLicense;
        }
      }
    } catch (err) {
      ApiLogger.warn('LicenseService', `Failed to read local license file: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fallback to initial embedded evaluation license
    return DEFAULT_SIGNED_LICENSE as unknown as ISignedLicense;
  }

  /**
   * Evaluates and validates license integrity, signatures, time, and expiration.
   */
  public static async validateLicense(
    licenseToTest?: ISignedLicense,
    forceRecheck: boolean = false
  ): Promise<ILicenseValidationResult> {
    const nowMs = Date.now();
    if (!forceRecheck && !licenseToTest && this.cachedResult && nowMs - this.lastCheckTime < this.CACHE_TTL_MS) {
      return this.cachedResult;
    }

    const signedLicense = licenseToTest || this.loadActiveLicense();
    const validatedAt = new Date().toISOString();

    // 1. Check basic structure
    if (!signedLicense || !signedLicense.payload || !signedLicense.signature) {
      return {
        isValid: false,
        status: 'NOT_FOUND',
        reason: 'A valid application license could not be found.',
        validatedAt,
      };
    }

    const { payload } = signedLicense;

    // 2. Verify Cryptographic Asymmetric Signature
    const isSignatureValid = this.verifySignature(signedLicense);
    if (!isSignatureValid) {
      return {
        isValid: false,
        status: 'TAMPERED',
        licenseId: payload.licenseId,
        customerId: payload.customerId,
        reason: 'This application license is invalid or has been modified. Please contact your administrator.',
        validatedAt,
      };
    }

    // 3. Verify Product identifier
    if (payload.product !== LICENSE_CONFIG.product) {
      return {
        isValid: false,
        status: 'INVALID',
        licenseId: payload.licenseId,
        reason: `License is for a different product: "${payload.product}". Expected "${LICENSE_CONFIG.product}".`,
        validatedAt,
      };
    }

    // 4. Verify Machine Binding
    const currentMachineHash = this.getMachineFingerprint();
    const isMachineBound = Boolean(payload.machineBinding && payload.machineBinding !== '*');
    if (isMachineBound && payload.machineBinding !== currentMachineHash) {
      return {
        isValid: false,
        status: 'INVALID',
        licenseId: payload.licenseId,
        machineBound: true,
        reason: 'This license is bound to a different hardware workstation.',
        validatedAt,
      };
    }

    // 5. Time & Clock Verification
    const localNow = new Date();
    const localState = this.loadLocalState();
    const lastTrusted = new Date(localState.lastTrustedTime);

    // Attempt trusted network time
    const networkTime = await this.fetchTrustedNetworkTime(2500);
    let effectiveCurrentTime: Date;

    if (networkTime) {
      // Network time reached
      effectiveCurrentTime = networkTime;

      // Check if local clock was wound backwards significantly
      const rollbackDriftMs = networkTime.getTime() - localNow.getTime();
      const toleranceMs = LICENSE_CONFIG.clockToleranceMinutes * 60 * 1000;

      if (rollbackDriftMs > toleranceMs) {
        ApiLogger.warn('LicenseService', `Local clock rollback detected: Local clock is ${Math.round(rollbackDriftMs / 60000)} minutes behind network time`);
      }

      // Update trusted time state
      localState.lastTrustedTime = networkTime.toISOString();
      localState.lastSuccessfulValidation = validatedAt;
      localState.lastLocalTime = localNow.toISOString();
      this.saveLocalState(localState);
    } else {
      // Offline mode
      const toleranceMs = LICENSE_CONFIG.clockToleranceMinutes * 60 * 1000;

      // Check if local clock is before last trusted time (clock rollback)
      if (localNow.getTime() < lastTrusted.getTime() - toleranceMs) {
        return {
          isValid: false,
          status: 'CLOCK_SUSPICIOUS',
          licenseId: payload.licenseId,
          reason: 'System clock has been set backwards. Please restore standard system time to continue.',
          validatedAt,
        };
      }

      // Check offline grace period
      const offlineDurationMs = localNow.getTime() - lastTrusted.getTime();
      const maxOfflineMs = LICENSE_CONFIG.offlineGraceDays * 24 * 60 * 60 * 1000;

      if (offlineDurationMs > maxOfflineMs) {
        return {
          isValid: false,
          status: 'OFFLINE_EXCEEDED',
          licenseId: payload.licenseId,
          reason: `Offline grace period (${LICENSE_CONFIG.offlineGraceDays} days) has expired. Please connect to the internet for a momentary license sync.`,
          validatedAt,
        };
      }

      effectiveCurrentTime = localNow;
      localState.lastLocalTime = localNow.toISOString();
      this.saveLocalState(localState);
    }

    // 6. Expiration Evaluation
    const issuedAt = new Date(payload.issuedAt);
    const expiresAt = new Date(payload.expiresAt);

    if (isNaN(expiresAt.getTime())) {
      return {
        isValid: false,
        status: 'INVALID',
        licenseId: payload.licenseId,
        reason: 'License contains an invalid expiration timestamp format.',
        validatedAt,
      };
    }

    // Check if current time is before issued date (future license)
    if (effectiveCurrentTime.getTime() < issuedAt.getTime() - (LICENSE_CONFIG.clockToleranceMinutes * 60 * 1000)) {
      return {
        isValid: false,
        status: 'INVALID',
        licenseId: payload.licenseId,
        reason: 'License issue date is in the future.',
        validatedAt,
      };
    }

    // Check expiry
    const isExpired = effectiveCurrentTime.getTime() >= expiresAt.getTime();
    const remainingMs = expiresAt.getTime() - effectiveCurrentTime.getTime();
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    let status: LicenseStatus = 'VALID';
    let warning: string | undefined;

    if (isExpired) {
      status = 'EXPIRED';
    } else if (daysRemaining <= LICENSE_CONFIG.expiryWarningDays) {
      status = 'EXPIRING_SOON';
      warning = `Your application license expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Please contact your administrator for renewal.`;
    }

    const result: ILicenseValidationResult = {
      isValid: !isExpired,
      status,
      licenseId: payload.licenseId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      daysRemaining,
      customerId: payload.customerId,
      issuedTo: payload.issuedTo,
      organization: payload.organization,
      features: payload.features,
      machineBound: isMachineBound,
      warning,
      lastTrustedTime: localState.lastTrustedTime,
      validatedAt,
    };

    if (!licenseToTest) {
      this.cachedResult = result;
      this.lastCheckTime = nowMs;
    }

    return result;
  }

  /**
   * Retrieves high-level safe status for API and UI consumption.
   */
  public static async getLicenseStatus(): Promise<ILicenseValidationResult> {
    return this.validateLicense();
  }

  /**
   * Atomically validates and imports a newly provided signed license file.
   */
  public static async importLicense(
    rawContent: string,
    actorInfo?: { id?: string; email?: string; role?: string }
  ): Promise<{ success: boolean; status: ILicenseValidationResult; message: string }> {
    if (!rawContent || typeof rawContent !== 'string') {
      throw AppError.badRequest('License content must be a valid non-empty string.');
    }

    let parsed: ISignedLicense;
    try {
      parsed = JSON.parse(rawContent.trim());
    } catch {
      throw AppError.badRequest('License file is not valid JSON.');
    }

    // Pre-validate new license before committing to storage
    const validation = await this.validateLicense(parsed, true);

    if (!validation.isValid && validation.status !== 'EXPIRING_SOON') {
      // Record audit failure
      await AuditService.record({
        actorId: actorInfo?.id,
        actorEmail: actorInfo?.email,
        actorRole: (actorInfo?.role as any) || 'SYSTEM',
        action: 'LICENSE_VALIDATION_FAILED',
        category: 'SECURITY',
        resourceType: 'License',
        resourceId: parsed.payload?.licenseId,
        result: 'FAILURE',
        metadata: {
          status: validation.status,
          reason: validation.reason,
        },
      });

      throw AppError.badRequest(validation.reason || `Import failed: License status is "${validation.status}".`);
    }

    // Atomic Write
    const licPath = this.getLicenseFilePath();
    const tempPath = `${licPath}.tmp`;

    try {
      fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2), 'utf8');
      fs.renameSync(tempPath, licPath);
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      throw AppError.internal('Failed to persist imported license to application storage.');
    }

    // Invalidate cached result
    this.cachedResult = validation;
    this.lastCheckTime = Date.now();

    // Record Audit Success
    await AuditService.record({
      actorId: actorInfo?.id,
      actorEmail: actorInfo?.email,
      actorRole: (actorInfo?.role as any) || 'SYSTEM',
      action: 'LICENSE_IMPORTED',
      category: 'SECURITY',
      resourceType: 'License',
      resourceId: validation.licenseId,
      result: 'SUCCESS',
      metadata: {
        licenseId: validation.licenseId,
        customerId: validation.customerId,
        expiresAt: validation.expiresAt,
        daysRemaining: validation.daysRemaining,
      },
    });

    ApiLogger.info('LicenseService', `New license imported successfully [ID: ${validation.licenseId}, Expires: ${validation.expiresAt}]`);

    return {
      success: true,
      status: validation,
      message: 'License imported and activated successfully.',
    };
  }
}
