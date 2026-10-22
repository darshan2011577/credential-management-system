import mongoose from 'mongoose';
import {
  PasswordHealthDetailsResponse,
  PasswordHealthIssue,
  PasswordHealthResult,
  PasswordHealthStatus,
  PasswordHealthSummary,
  PasswordReuseGroup,
} from '@credential-manager/types';
import { AUTH_CONFIG, PASSWORD_HEALTH_CONFIG } from '@credential-manager/config';
import { logger } from '@credential-manager/shared';
import { CredentialModel, ICredentialDocument } from '../../models/credential.model.js';
import { EncryptionService } from '../encryption.service.js';
import { PasswordStrengthService } from './password-strength.service.js';
import { PasswordAgeService } from './password-age.service.js';
import { getRedisClient } from '../../infrastructure/redis/redis.js';
import { AppError } from '../../utils/errors.js';

const HEALTH_CACHE_KEY_PREFIX = 'password-health:';

// In-memory fallback cache for health summaries when Redis is unavailable
const memoryHealthCache = new Map<string, { summary: PasswordHealthSummary; expiresAtEpoch: number }>();

export class PasswordHealthService {
  /**
   * Retrieves or computes the aggregated password health summary for an employee.
   * Leverages Redis cache (non-sensitive summary metadata only) for optimal performance.
   */
  public static async getSummary(userId: string): Promise<PasswordHealthSummary> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    // 1. Try retrieving summary from Redis cache
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const cached = await redis.get(`${HEALTH_CACHE_KEY_PREFIX}${userId}`);
        if (cached) {
          return JSON.parse(cached) as PasswordHealthSummary;
        }
      } catch (err: unknown) {
        logger.warn(`[PasswordHealthService]: Redis cache read error for user ${userId}: ${String(err)}`);
      }
    } else {
      // Check memory cache fallback
      const memItem = memoryHealthCache.get(userId);
      if (memItem) {
        if (Date.now() < memItem.expiresAtEpoch) {
          return memItem.summary;
        }
        memoryHealthCache.delete(userId);
      }
    }

    // 2. Perform live analysis
    const analysis = await this.performFullAnalysis(userId);

    // 3. Cache non-sensitive summary metadata in Redis / memory
    await this.setSummaryCache(userId, analysis.summary);

    return analysis.summary;
  }

  /**
   * Retrieves detailed credential health analysis for all credentials owned by the employee.
   */
  public static async getCredentialHealthList(
    userId: string
  ): Promise<PasswordHealthDetailsResponse> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const analysis = await this.performFullAnalysis(userId);

    // Refresh summary cache asynchronously
    this.setSummaryCache(userId, analysis.summary).catch((err) =>
      logger.warn(`[PasswordHealthService]: Failed to refresh summary cache: ${String(err)}`)
    );

    return analysis;
  }

  /**
   * Retrieves password health analysis for a single credential with strict ownership isolation.
   */
  public static async getSingleCredentialHealth(
    userId: string,
    credentialId: string
  ): Promise<PasswordHealthResult> {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    // Run full analysis to ensure accurate cross-vault reuse calculation
    const analysis = await this.performFullAnalysis(userId);
    const targetItem = analysis.items.find((item) => item.credentialId === credentialId);

    if (!targetItem) {
      const existsElsewhere = await CredentialModel.exists({
        _id: new mongoose.Types.ObjectId(credentialId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You do not have permission to view health for this credential.');
      }
      throw AppError.notFound('Credential not found.');
    }

    return targetItem;
  }

  /**
   * Invalidates cached health summary when credentials are created, modified, or deleted.
   */
  public static async invalidateCache(userId: string): Promise<void> {
    if (!userId) return;

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        await redis.del(`${HEALTH_CACHE_KEY_PREFIX}${userId}`);
      } catch (err: unknown) {
        logger.warn(`[PasswordHealthService]: Redis cache invalidation error: ${String(err)}`);
      }
    }

    memoryHealthCache.delete(userId);
  }

  // --------------------------------------------------------------------------
  // Core Analysis Engine (Transient Backend Memory Processing)
  // --------------------------------------------------------------------------

  private static async performFullAnalysis(
    userId: string
  ): Promise<PasswordHealthDetailsResponse> {
    const credentials = await CredentialModel.find({
      ownerId: new mongoose.Types.ObjectId(userId),
    })
      .select('+encryptedPassword')
      .sort({ createdAt: -1 })
      .exec();

    const nowIso = new Date().toISOString();

    if (!credentials || credentials.length === 0) {
      const emptySummary: PasswordHealthSummary = {
        score: 100,
        status: 'HEALTHY',
        totalCredentials: 0,
        healthyCredentials: 0,
        weakCredentials: 0,
        reusedCredentials: 0,
        oldCredentials: 0,
        policyViolations: 0,
        reuseGroups: [],
        generatedAt: nowIso,
      };
      return { summary: emptySummary, items: [] };
    }

    // Step 1: Transient Decryption & In-Memory Property Extraction
    interface TransientRecord {
      doc: ICredentialDocument;
      rawPassword: string;
      strength: ReturnType<typeof PasswordStrengthService.analyze>;
      age: ReturnType<typeof PasswordAgeService.analyze>;
      policyCompliant: boolean;
    }

    const transientRecords: TransientRecord[] = [];
    const passwordGroups = new Map<string, string[]>(); // rawPassword -> credentialIds[]

    for (const doc of credentials) {
      let rawPassword = '';
      if (doc.encryptedPassword) {
        try {
          rawPassword = EncryptionService.decrypt(doc.encryptedPassword);
        } catch {
          rawPassword = '';
        }
      }

      const strength = PasswordStrengthService.analyze(rawPassword);
      const age = PasswordAgeService.analyze(doc.passwordChangedAt, doc.createdAt);

      // Check Policy Compliance
      const policyCompliant = this.checkPolicyCompliance(rawPassword);

      // In-Memory Exact Reuse Grouping
      if (rawPassword) {
        const existingList = passwordGroups.get(rawPassword) || [];
        existingList.push(doc._id.toString());
        passwordGroups.set(rawPassword, existingList);
      }

      transientRecords.push({
        doc,
        rawPassword,
        strength,
        age,
        policyCompliant,
      });
    }

    // Compile Reuse Groups Metadata (Counts and IDs only, NO passwords)
    const reuseGroups: PasswordReuseGroup[] = [];
    for (const [, credIds] of passwordGroups.entries()) {
      if (credIds.length > 1) {
        reuseGroups.push({
          count: credIds.length,
          credentialIds: credIds,
        });
      }
    }

    // Step 2: Compute Item-Level Health Scores, Issues, and Recommendations
    const items: PasswordHealthResult[] = [];
    let weakCount = 0;
    let reusedCount = 0;
    let oldCount = 0;
    let policyViolationCount = 0;
    let healthyCount = 0;
    let totalScoreSum = 0;

    for (const rec of transientRecords) {
      const { doc, rawPassword, strength, age, policyCompliant } = rec;

      const credId = doc._id.toString();
      const sharedList = passwordGroups.get(rawPassword) || [];
      const reused = sharedList.length > 1;
      const reuseCount = sharedList.length;

      const issues: PasswordHealthIssue[] = [];
      const recommendations: string[] = [];

      // Scoring Deductions
      let scoreDeductions = 0;

      // 1. Strength Evaluation
      if (strength.level === 'VERY_WEAK') {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.veryWeakStrength;
        weakCount++;
        issues.push({
          code: 'VERY_WEAK_PASSWORD',
          message: 'Password strength is critically weak and easily crackable.',
          severity: 'CRITICAL',
        });
        recommendations.push('Generate a strong 16+ character password using numbers and symbols.');
      } else if (strength.level === 'WEAK') {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.weakStrength;
        weakCount++;
        issues.push({
          code: 'WEAK_PASSWORD',
          message: 'Password strength is weak with low character entropy.',
          severity: 'HIGH',
        });
        recommendations.push('Increase password length and include mixed uppercase, numbers, and symbols.');
      } else if (strength.level === 'MEDIUM') {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.mediumStrength;
        recommendations.push('Consider upgrading password complexity to achieve maximum security.');
      }

      // 2. Policy Compliance Evaluation
      if (!policyCompliant) {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.policyViolation;
        policyViolationCount++;
        issues.push({
          code: 'POLICY_VIOLATION',
          message: `Password does not meet college password policy (min ${AUTH_CONFIG.passwordMinLength} characters with uppercase, lowercase, and numbers).`,
          severity: 'HIGH',
        });
        recommendations.push('Update the credential to comply with institutional security policies.');
      }

      // 3. Password Reuse Evaluation
      if (reused) {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.reusedPassword;
        reusedCount++;
        issues.push({
          code: 'PASSWORD_REUSED',
          message: `This password is identical to ${reuseCount - 1} other credential(s) in your vault.`,
          severity: 'HIGH',
        });
        recommendations.push('Replace with a unique password to avoid lateral account takeover.');
      }

      // 4. Age Evaluation
      if (age.ageStatus === 'CRITICAL') {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.criticalOldPassword;
        oldCount++;
        issues.push({
          code: 'VERY_OLD_PASSWORD',
          message: `Password is ${age.ageDays} days old (exceeds ${PASSWORD_HEALTH_CONFIG.criticalAgeDays} days threshold).`,
          severity: 'MEDIUM',
        });
        recommendations.push('Rotate this credential password as part of regular security maintenance.');
      } else if (age.ageStatus === 'OLD') {
        scoreDeductions += PASSWORD_HEALTH_CONFIG.scoringDeductions.oldPassword;
        oldCount++;
        issues.push({
          code: 'PASSWORD_TOO_OLD',
          message: `Password is ${age.ageDays} days old (over ${PASSWORD_HEALTH_CONFIG.oldAgeDays} days recommendation).`,
          severity: 'LOW',
        });
        recommendations.push('Consider rotating this password soon.');
      }

      // Calculate Item Health Score (0 - 100)
      const itemScore = Math.max(0, Math.min(100, 100 - scoreDeductions));
      totalScoreSum += itemScore;

      if (issues.length === 0) {
        healthyCount++;
      }

      items.push({
        credentialId: credId,
        title: doc.title,
        category: doc.category,
        username: doc.username,
        website: doc.website || undefined,
        strength: strength.level,
        strengthScore: strength.score,
        policyCompliant,
        reused,
        reuseCount,
        passwordAgeDays: age.ageDays,
        ageStatus: age.ageStatus,
        score: itemScore,
        issues,
        recommendations,
        analyzedAt: nowIso,
      });

      // Crucial Security Principle: Discard transient raw secret immediately
      rec.rawPassword = '';
    }

    // Step 3: Compute Overall Employee Health Score & Status
    const totalCount = credentials.length;
    const overallScore = totalCount > 0 ? Math.round(totalScoreSum / totalCount) : 100;

    let overallStatus: PasswordHealthStatus = 'HEALTHY';
    if (overallScore < PASSWORD_HEALTH_CONFIG.statusThresholds.atRiskMin) {
      overallStatus = 'CRITICAL';
    } else if (overallScore < PASSWORD_HEALTH_CONFIG.statusThresholds.needsAttentionMin) {
      overallStatus = 'AT_RISK';
    } else if (overallScore < PASSWORD_HEALTH_CONFIG.statusThresholds.healthyMin) {
      overallStatus = 'NEEDS_ATTENTION';
    }

    const summary: PasswordHealthSummary = {
      score: overallScore,
      status: overallStatus,
      totalCredentials: totalCount,
      healthyCredentials: healthyCount,
      weakCredentials: weakCount,
      reusedCredentials: reusedCount,
      oldCredentials: oldCount,
      policyViolations: policyViolationCount,
      reuseGroups,
      generatedAt: nowIso,
    };

    return {
      summary,
      items,
    };
  }

  private static checkPolicyCompliance(password: string): boolean {
    if (!password || password.length < AUTH_CONFIG.passwordMinLength) {
      return false;
    }
    const policy = AUTH_CONFIG.passwordPolicy;
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
    if (policy.requireNumbers && !/[0-9]/.test(password)) return false;
    if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) return false;
    return true;
  }

  private static async setSummaryCache(
    userId: string,
    summary: PasswordHealthSummary
  ): Promise<void> {
    const ttlSeconds = PASSWORD_HEALTH_CONFIG.cacheTtlSeconds;

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        await redis.set(
          `${HEALTH_CACHE_KEY_PREFIX}${userId}`,
          JSON.stringify(summary),
          'EX',
          ttlSeconds
        );
        return;
      } catch (err: unknown) {
        logger.warn(`[PasswordHealthService]: Failed to write summary to Redis: ${String(err)}`);
      }
    }

    // Memory fallback
    memoryHealthCache.set(userId, {
      summary,
      expiresAtEpoch: Date.now() + ttlSeconds * 1000,
    });
  }
}
