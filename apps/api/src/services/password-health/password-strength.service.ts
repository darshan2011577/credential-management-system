import { PasswordStrengthLevel } from '@credential-manager/types';

export interface PasswordStrengthAnalysis {
  score: number; // 0-100
  level: PasswordStrengthLevel;
  length: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSymbols: boolean;
  uniqueCharsCount: number;
  warnings: string[];
}

const COMMON_PATTERNS = [
  'password',
  'admin',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'welcome',
  'letmein',
  'monkey',
  'dragon',
  'football',
  'master',
  'superman',
  'iloveyou',
];

export class PasswordStrengthService {
  /**
   * Analyzes password complexity across length, character pool diversity,
   * entropy, sequential pattern matching, and dictionary penalties.
   */
  public static analyze(password: string): PasswordStrengthAnalysis {
    if (!password || typeof password !== 'string') {
      return {
        score: 0,
        level: 'VERY_WEAK',
        length: 0,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSymbols: false,
        uniqueCharsCount: 0,
        warnings: ['Password is empty'],
      };
    }

    const length = password.length;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[^A-Za-z0-9]/.test(password);

    const uniqueChars = new Set(password.split('')).size;
    const warnings: string[] = [];

    // 1. Length Score (0 - 35 points)
    let lengthScore = 0;
    if (length < 6) {
      lengthScore = 5;
      warnings.push('Password length is critically short (under 6 characters)');
    } else if (length < 8) {
      lengthScore = 12;
      warnings.push('Password is under recommended 8 characters');
    } else if (length <= 11) {
      lengthScore = 20;
    } else if (length <= 15) {
      lengthScore = 28;
    } else {
      lengthScore = 35;
    }

    // 2. Character Variety Score (0 - 30 points)
    const varietyCount = [hasUppercase, hasLowercase, hasNumbers, hasSymbols].filter(Boolean).length;
    let varietyScore = 0;
    if (varietyCount === 1) {
      varietyScore = 6;
      warnings.push('Password uses only a single character type');
    } else if (varietyCount === 2) {
      varietyScore = 14;
    } else if (varietyCount === 3) {
      varietyScore = 22;
    } else if (varietyCount === 4) {
      varietyScore = 30;
    }

    // 3. Uniqueness & Entropy Estimation (0 - 35 points)
    const uniquenessRatio = Math.min(1, uniqueChars / length);
    const uniquenessScore = uniquenessRatio * 20;

    let poolSize = 0;
    if (hasLowercase) poolSize += 26;
    if (hasUppercase) poolSize += 26;
    if (hasNumbers) poolSize += 10;
    if (hasSymbols) poolSize += 32;

    const entropyBits = poolSize > 0 ? length * Math.log2(poolSize) : 0;
    const entropyScore = Math.min(15, (entropyBits / 80) * 15);

    // 4. Deductions / Pattern Penalties (0 to -40 points)
    let penalties = 0;
    const lower = password.toLowerCase();

    // Repeated character sequences (e.g., 'aaaa', '1111')
    if (/(.)\1{2,}/.test(password)) {
      penalties += 12;
      warnings.push('Contains repetitive character sequences');
    }

    // Sequential numbers or alphabet runs (e.g. '12345', 'abcdef')
    if (this.containsSequence(lower)) {
      penalties += 15;
      warnings.push('Contains predictable incremental character sequence');
    }

    // Common weak dictionary keywords
    for (const pattern of COMMON_PATTERNS) {
      if (lower.includes(pattern)) {
        penalties += 25;
        warnings.push(`Contains commonly guessed keyword "${pattern}"`);
        break;
      }
    }

    // Compute raw composite score
    const rawScore = lengthScore + varietyScore + uniquenessScore + entropyScore - penalties;
    const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    // Map to Strength Levels
    let level: PasswordStrengthLevel = 'MEDIUM';
    if (finalScore < 30) {
      level = 'VERY_WEAK';
    } else if (finalScore < 50) {
      level = 'WEAK';
    } else if (finalScore < 70) {
      level = 'MEDIUM';
    } else if (finalScore < 85) {
      level = 'STRONG';
    } else {
      level = 'VERY_STRONG';
    }

    return {
      score: finalScore,
      level,
      length,
      hasUppercase,
      hasLowercase,
      hasNumbers,
      hasSymbols,
      uniqueCharsCount: uniqueChars,
      warnings,
    };
  }

  private static containsSequence(str: string): boolean {
    if (str.length < 4) return false;
    for (let i = 0; i < str.length - 3; i++) {
      const c1 = str.charCodeAt(i);
      const c2 = str.charCodeAt(i + 1);
      const c3 = str.charCodeAt(i + 2);
      const c4 = str.charCodeAt(i + 3);
      if (c2 === c1 + 1 && c3 === c2 + 1 && c4 === c3 + 1) {
        return true;
      }
      if (c2 === c1 - 1 && c3 === c2 - 1 && c4 === c3 - 1) {
        return true;
      }
    }
    return false;
  }
}
