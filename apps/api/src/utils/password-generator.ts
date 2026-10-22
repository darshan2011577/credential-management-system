import crypto from 'crypto';
import { GeneratePasswordDto } from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';
import { AppError } from './errors.js';

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

export class PasswordGenerator {
  /**
   * Generates a cryptographically secure random password using Node.js crypto.randomInt.
   * Guarantees at least one character from each selected character set.
   */
  public static generate(options: GeneratePasswordDto = {}): string {
    const minLen = CREDENTIAL_CONFIG.passwordGenerator.minLength;
    const maxLen = CREDENTIAL_CONFIG.passwordGenerator.maxLength;
    const requestedLength = options.length ?? CREDENTIAL_CONFIG.passwordGenerator.defaultLength;

    if (requestedLength < minLen || requestedLength > maxLen) {
      throw AppError.badRequest(`Password length must be between ${minLen} and ${maxLen} characters.`);
    }

    const useUpper = options.uppercase ?? true;
    const useLower = options.lowercase ?? true;
    const useNumbers = options.numbers ?? true;
    const useSymbols = options.symbols ?? true;

    if (!useUpper && !useLower && !useNumbers && !useSymbols) {
      throw AppError.badRequest('At least one character group (uppercase, lowercase, numbers, or symbols) must be enabled.');
    }

    const guaranteedChars: string[] = [];
    let combinedPool = '';

    if (useUpper) {
      guaranteedChars.push(CHAR_SETS.uppercase[crypto.randomInt(0, CHAR_SETS.uppercase.length)]);
      combinedPool += CHAR_SETS.uppercase;
    }
    if (useLower) {
      guaranteedChars.push(CHAR_SETS.lowercase[crypto.randomInt(0, CHAR_SETS.lowercase.length)]);
      combinedPool += CHAR_SETS.lowercase;
    }
    if (useNumbers) {
      guaranteedChars.push(CHAR_SETS.numbers[crypto.randomInt(0, CHAR_SETS.numbers.length)]);
      combinedPool += CHAR_SETS.numbers;
    }
    if (useSymbols) {
      guaranteedChars.push(CHAR_SETS.symbols[crypto.randomInt(0, CHAR_SETS.symbols.length)]);
      combinedPool += CHAR_SETS.symbols;
    }

    const remainingLength = requestedLength - guaranteedChars.length;
    const passwordChars: string[] = [...guaranteedChars];

    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = crypto.randomInt(0, combinedPool.length);
      passwordChars.push(combinedPool[randomIndex]);
    }

    // Unbiased cryptographic Fisher-Yates shuffle
    for (let i = passwordChars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const temp = passwordChars[i];
      passwordChars[i] = passwordChars[j];
      passwordChars[j] = temp;
    }

    return passwordChars.join('');
  }
}
