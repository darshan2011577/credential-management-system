import crypto from 'crypto';
import { EncryptedData } from '@credential-manager/types';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '@credential-manager/shared';

export class EncryptionService {
  private static cachedKey: Buffer | null = null;

  /**
   * Resolves and validates the 32-byte encryption key from environment configuration.
   * Accepts 64-char Hex, 44-char Base64, or 32-byte raw string.
   */
  public static getKey(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    const rawKey = env.CREDENTIAL_ENCRYPTION_KEY;
    if (!rawKey || typeof rawKey !== 'string') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is missing in environment configuration.');
    }

    let keyBuffer: Buffer;

    // Check 64-char Hex (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      keyBuffer = Buffer.from(rawKey, 'hex');
    }
    // Check 44-char Base64 (32 bytes)
    else if (/^[A-Za-z0-9+/]{43}=$/.test(rawKey) || (rawKey.length === 44 && rawKey.endsWith('='))) {
      keyBuffer = Buffer.from(rawKey, 'base64');
    }
    // Check raw 32-byte UTF-8 string
    else {
      keyBuffer = Buffer.from(rawKey, 'utf8');
    }

    if (keyBuffer.length !== 32) {
      throw new Error(
        `Invalid CREDENTIAL_ENCRYPTION_KEY length: Expected 32 bytes (64 hex characters or 44 base64 characters), but received ${keyBuffer.length} bytes.`
      );
    }

    this.cachedKey = keyBuffer;
    return keyBuffer;
  }

  /**
   * Validates encryption engine during application startup.
   * Performs an internal self-test encrypt/decrypt cycle.
   */
  public static validateEngine(): void {
    try {
      const key = this.getKey();
      const testString = `self-test-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);

      if (decrypted !== testString) {
        throw new Error('Encryption engine self-test failed: Decrypted plaintext does not match test string.');
      }
      logger.info('AES-256-GCM Encryption Engine validated successfully (32-byte master key loaded).');
    } catch (error) {
      logger.error('Encryption Engine validation failed:', error);
      throw error;
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh 12-byte cryptographically secure IV.
   */
  public static encrypt(plaintext: string): EncryptedData {
    if (typeof plaintext !== 'string') {
      throw AppError.badRequest('Plaintext to encrypt must be a valid string.');
    }

    const key = this.getKey();
    // Fresh 12-byte IV for every encryption operation (NIST SP 800-38D recommendation)
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertextBuffer = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    // 16-byte authentication tag
    const authTag = cipher.getAuthTag();

    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertextBuffer.toString('base64'),
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload and verifies the 16-byte authentication tag.
   * Fails safely if ciphertext, IV, or authTag has been tampered with.
   */
  public static decrypt(data: EncryptedData): string {
    if (!data || typeof data !== 'object') {
      throw AppError.badRequest('Invalid encrypted data payload.');
    }

    if (data.version !== 1 || data.algorithm !== 'aes-256-gcm') {
      throw AppError.internal(`Unsupported encryption format version: ${data.version} (${data.algorithm})`);
    }

    if (!data.iv || !data.authTag || !data.ciphertext) {
      throw AppError.internal('Malformed encrypted payload: Missing IV, authTag, or ciphertext.');
    }

    try {
      const key = this.getKey();
      const iv = Buffer.from(data.iv, 'base64');
      const authTag = Buffer.from(data.authTag, 'base64');
      const ciphertext = Buffer.from(data.ciphertext, 'base64');

      if (iv.length !== 12) {
        throw new Error('Invalid IV length for AES-256-GCM.');
      }
      if (authTag.length !== 16) {
        throw new Error('Invalid authTag length for AES-256-GCM.');
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decryptedBuffer = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decryptedBuffer.toString('utf8');
    } catch (error) {
      // Catch authentication failures / tampering and return a safe error
      logger.error('AES-256-GCM Decryption failed (integrity/authentication failure):', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AppError.internal('Decryption failed or data integrity check failed. The credential may have been tampered with.');
    }
  }
}
