import mongoose from 'mongoose';
import {
  AdminDashboardData,
  AdminDashboardDateRange,
  AdminDashboardQuery,
  AdminDashboardEmployeeStats,
  AdminDashboardCredentialStats,
  AdminDashboardPasswordHealthStats,
  AdminDashboardSharingStats,
  AdminDashboardAuditStats,
  AdminDashboardRecentActivityItem,
  AdminDashboardEmployeeOverviewItem,
  CredentialCategory,
  AuditCategory,
  PasswordHealthStatus,
  UserRole,
  UserStatus,
  AuditAction,
  AuditResult,
} from '@credential-manager/types';
import { UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { CredentialShareModel } from '../models/credential-share.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { PasswordHealthService } from './password-health/password-health.service.js';
import { LicenseService } from './license.service.js';
import { getRedisClient } from '../infrastructure/redis/redis.js';
import { ApiLogger } from '../utils/logger.js';

const DASHBOARD_CACHE_PREFIX = 'admin:dashboard:';
const DASHBOARD_CACHE_TTL_SECONDS = 30; // 30s cache TTL for live dashboard

export class AdminDashboardService {
  /**
   * Resolves date boundaries based on date range filter.
   */
  private static resolveDateRange(query: AdminDashboardQuery): {
    dateRange: AdminDashboardDateRange;
    startDate?: Date;
    endDate: Date;
  } {
    const dateRange = query.dateRange || 'LAST_30_DAYS';
    const endDate = query.to ? new Date(query.to) : new Date();
    let startDate: Date | undefined;

    if (query.from) {
      startDate = new Date(query.from);
    } else {
      const now = new Date();
      switch (dateRange) {
        case 'TODAY': {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          break;
        }
        case 'LAST_7_DAYS': {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case 'LAST_30_DAYS': {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
        case 'THIS_MONTH': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        }
        case 'ALL_TIME':
        default: {
          startDate = undefined;
          break;
        }
      }
    }

    return { dateRange, startDate, endDate };
  }

  /**
   * Formats human-friendly descriptions for recent audit actions.
   */
  private static formatActionDescription(action: string, targetName?: string): string {
    const descMap: Record<string, string> = {
      LOGIN_SUCCESS: 'User logged into application',
      LOGIN_FAILURE: 'Failed login attempt detected',
      USER_REGISTERED: 'New employee registered into platform',
      PASSWORD_CHANGED: 'User updated login master password',
      CREDENTIAL_CREATED: 'New credential created in secure vault',
      CREDENTIAL_UPDATED: 'Credential metadata updated in vault',
      CREDENTIAL_DELETED: 'Credential deleted from vault',
      CREDENTIAL_REVEALED: 'Sensitive credential password revealed',
      PASSWORD_HEALTH_VIEWED: 'Password health analysis conducted',
      CREDENTIAL_SHARED: 'Credential share created and sent',
      SHARE_APPROVED: 'Credential share request approved',
      SHARE_REJECTED: 'Credential share request rejected',
      SHARE_REVOKED: 'Credential share access revoked',
      SHARED_CREDENTIAL_REVEALED: 'Shared credential revealed by recipient',
      LICENSE_VALIDATED: 'Application digital license verified',
      LICENSE_VALIDATION_FAILED: 'License verification error or tampering detected',
      LICENSE_IMPORTED: 'New license file imported and activated',
    };

    const base = descMap[action] || action.replace(/_/g, ' ').toLowerCase();
    if (targetName) {
      return `${base} for ${targetName}`;
    }
    return base;
  }

  /**
   * Aggregates complete dashboard data with Redis caching.
   */
  public static async getDashboardStats(query: AdminDashboardQuery): Promise<AdminDashboardData> {
    const { dateRange, startDate, endDate } = this.resolveDateRange(query);
    const employeeId = query.employeeId;

    const cacheKey = `${DASHBOARD_CACHE_PREFIX}${dateRange}:${employeeId || 'all'}:${startDate?.getTime() || 0}`;

    // 1. Try reading from Redis cache
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as AdminDashboardData;
        }
      } catch (err) {
        ApiLogger.warn('AdminDashboardService', `Redis cache read error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Aggregate Employee Statistics
    const userMatch: Record<string, any> = {};
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      userMatch._id = new mongoose.Types.ObjectId(employeeId);
    }

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      suspendedEmployees,
      recentlyCreatedEmployees,
    ] = await Promise.all([
      UserModel.countDocuments(userMatch),
      UserModel.countDocuments({ ...userMatch, status: 'ACTIVE' }),
      UserModel.countDocuments({ ...userMatch, status: 'INACTIVE' }),
      UserModel.countDocuments({ ...userMatch, status: 'SUSPENDED' }),
      startDate
        ? UserModel.countDocuments({ ...userMatch, createdAt: { $gte: startDate, $lte: endDate } })
        : UserModel.countDocuments(userMatch),
    ]);

    const employeeStats: AdminDashboardEmployeeStats = {
      total: totalEmployees,
      active: activeEmployees,
      inactive: inactiveEmployees,
      suspended: suspendedEmployees,
      recentlyCreated: recentlyCreatedEmployees,
    };

    // 3. Aggregate Credential Statistics
    const credMatch: Record<string, any> = {};
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      credMatch.ownerId = new mongoose.Types.ObjectId(employeeId);
    }

    const [totalCredentials, favoriteCredentials, recentlyCreatedCredentials, categoryAgg] =
      await Promise.all([
        CredentialModel.countDocuments(credMatch),
        CredentialModel.countDocuments({ ...credMatch, favorite: true }),
        startDate
          ? CredentialModel.countDocuments({ ...credMatch, createdAt: { $gte: startDate, $lte: endDate } })
          : CredentialModel.countDocuments(credMatch),
        CredentialModel.aggregate([
          { $match: credMatch },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ]),
      ]);

    const byCategory: Record<CredentialCategory, number> = {
      DEVELOPMENT: 0,
      CLOUD: 0,
      DATABASE: 0,
      SERVER: 0,
      WEB_PORTAL: 0,
      API_KEY: 0,
      FINANCE: 0,
      SOCIAL: 0,
      EMAIL: 0,
      WORK: 0,
      PERSONAL: 0,
      OTHER: 0,
    };

    for (const cat of categoryAgg) {
      if (cat._id && byCategory[cat._id as CredentialCategory] !== undefined) {
        byCategory[cat._id as CredentialCategory] = cat.count;
      }
    }


    const credentialStats: AdminDashboardCredentialStats = {
      total: totalCredentials,
      active: totalCredentials,
      favorite: favoriteCredentials,
      byCategory,
      recentlyCreated: recentlyCreatedCredentials,
    };

    // 4. Aggregate Password Health Summary across employees
    const users = await UserModel.find(
      userMatch,
      { _id: 1, name: 1, email: 1, employeeId: 1, department: 1, role: 1, status: 1, createdAt: 1, lastLoginAt: 1 }
    ).lean();

    let healthyCount = 0;
    let needsAttentionCount = 0;
    let atRiskCount = 0;
    let criticalCount = 0;
    let totalWeakCount = 0;
    let totalReusedCount = 0;
    let totalOldCount = 0;
    let totalPolicyViolations = 0;
    let totalScoreSum = 0;
    let analyzedUsersCount = 0;

    const employeeOverviewList: AdminDashboardEmployeeOverviewItem[] = [];

    // Evaluate health metadata per employee safely without exposing raw passwords
    for (const u of users) {
      const uId = u._id.toString();
      const uCredCount = await CredentialModel.countDocuments({ ownerId: u._id });

      let userHealthStatus: PasswordHealthStatus = 'HEALTHY';
      let userHealthScore = 100;

      if (uCredCount > 0) {
        try {
          const summary = await PasswordHealthService.getSummary(uId);
          userHealthStatus = summary.status;
          userHealthScore = summary.score;

          healthyCount += summary.healthyCredentials;
          needsAttentionCount += summary.weakCredentials > 0 || summary.oldCredentials > 0 ? 1 : 0;
          totalWeakCount += summary.weakCredentials;
          totalReusedCount += summary.reusedCredentials;
          totalOldCount += summary.oldCredentials;
          totalPolicyViolations += summary.policyViolations;
          totalScoreSum += summary.score;
          analyzedUsersCount++;

          if (summary.status === 'AT_RISK') atRiskCount++;
          else if (summary.status === 'CRITICAL') criticalCount++;
        } catch {
          // Fallback if user health evaluation unavailable
        }
      }

      employeeOverviewList.push({
        id: uId,
        employeeId: u.employeeId,
        name: u.name,
        email: u.email,
        department: u.department,
        role: u.role as UserRole,
        status: u.status as UserStatus,
        credentialCount: uCredCount,
        healthStatus: userHealthStatus,
        healthScore: userHealthScore,
        lastActiveAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : undefined,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    const averageHealthScore = analyzedUsersCount > 0 ? Math.round(totalScoreSum / analyzedUsersCount) : 100;

    const passwordHealthStats: AdminDashboardPasswordHealthStats = {
      totalAnalyzed: totalCredentials,
      healthy: Math.max(0, totalCredentials - totalWeakCount - totalOldCount),
      needsAttention: needsAttentionCount,
      atRisk: atRiskCount,
      critical: criticalCount,
      weakCount: totalWeakCount,
      reusedCount: totalReusedCount,
      oldPasswordCount: totalOldCount,
      policyViolations: totalPolicyViolations,
      averageScore: averageHealthScore,
    };

    // 5. Aggregate Sharing Activity
    const shareMatch: Record<string, any> = {};
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      shareMatch.$or = [
        { ownerId: new mongoose.Types.ObjectId(employeeId) },
        { recipientId: new mongoose.Types.ObjectId(employeeId) },
      ];
    }
    if (startDate) {
      shareMatch.createdAt = { $gte: startDate, $lte: endDate };
    }

    const [
      totalShares,
      pendingShares,
      approvedShares,
      rejectedShares,
      revokedShares,
      expiredShares,
      recentShareDocs,
    ] = await Promise.all([
      CredentialShareModel.countDocuments(shareMatch),
      CredentialShareModel.countDocuments({ ...shareMatch, status: 'PENDING' }),
      CredentialShareModel.countDocuments({ ...shareMatch, status: 'ACTIVE' }),
      CredentialShareModel.countDocuments({ ...shareMatch, status: 'REJECTED' }),
      CredentialShareModel.countDocuments({ ...shareMatch, status: 'REVOKED' }),
      CredentialShareModel.countDocuments({ ...shareMatch, status: 'EXPIRED' }),
      CredentialShareModel.find(shareMatch)
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('credentialId', 'title')
        .populate('ownerId', 'name')
        .populate('recipientId', 'name')
        .lean(),
    ]);

    const recentShares = recentShareDocs.map((s: any) => ({
      id: s._id.toString(),
      credentialTitle: s.credentialId?.title || 'Credential',
      ownerName: s.ownerId?.name || 'Owner',
      recipientName: s.recipientId?.name || 'Recipient',
      permission: s.permission,
      status: s.status,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
    }));

    const sharingStats: AdminDashboardSharingStats = {
      total: totalShares,
      pending: pendingShares,
      approved: approvedShares,
      rejected: rejectedShares,
      revoked: revokedShares,
      expired: expiredShares,
      recentShares,
    };

    // 6. Aggregate Audit Activity & Timeline Chart Data
    const auditMatch: Record<string, any> = {};
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      auditMatch.actorId = employeeId;
    }
    if (startDate) {
      auditMatch.createdAt = { $gte: startDate, $lte: endDate };
    }

    const [totalAuditEvents, categoryAuditAgg, timelineAgg, recentAuditDocs] = await Promise.all([
      AuditLogModel.countDocuments(auditMatch),
      AuditLogModel.aggregate([
        { $match: auditMatch },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      AuditLogModel.aggregate([
        { $match: auditMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$result', 'SUCCESS'] }, 1, 0] },
            },
            failureCount: {
              $sum: { $cond: [{ $eq: ['$result', 'FAILURE'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
      AuditLogModel.find(auditMatch)
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
    ]);

    const auditByCategory: Record<AuditCategory, number> = {
      AUTHENTICATION: 0,
      USER_MANAGEMENT: 0,
      CREDENTIAL: 0,
      PASSWORD_HEALTH: 0,
      SHARING: 0,
      NOTIFICATION: 0,
      SECURITY: 0,
      SYSTEM: 0,
    };

    for (const cat of categoryAuditAgg) {
      if (cat._id && auditByCategory[cat._id as AuditCategory] !== undefined) {
        auditByCategory[cat._id as AuditCategory] = cat.count;
      }
    }


    const eventTimeline = timelineAgg.map((item) => ({
      date: item._id,
      count: item.count,
      successCount: item.successCount,
      failureCount: item.failureCount,
    }));

    const auditStats: AdminDashboardAuditStats = {
      totalEvents: totalAuditEvents,
      byCategory: auditByCategory,
      eventTimeline,
    };

    // 7. Recent Platform Activity Feed (Sanitized, zero secret exposure)
    const recentActivity: AdminDashboardRecentActivityItem[] = recentAuditDocs.map((doc: any) => ({
      id: doc._id.toString(),
      action: doc.action as AuditAction,
      actionDescription: this.formatActionDescription(doc.action, doc.actorName),
      category: doc.category as AuditCategory,
      actorName: doc.actorName || doc.actorEmail || 'System Actor',
      actorEmail: doc.actorEmail || 'system@internal',
      actorRole: doc.actorRole as UserRole | 'SYSTEM',
      result: doc.result as AuditResult,
      timestamp: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    }));

    // 8. License Status from Phase 11 License Engine
    const licenseStatus = await LicenseService.getLicenseStatus();

    const result: AdminDashboardData = {
      dateRange,
      calculatedFrom: startDate?.toISOString(),
      calculatedTo: endDate.toISOString(),
      employees: employeeStats,
      credentials: credentialStats,
      passwordHealth: passwordHealthStats,
      sharing: sharingStats,
      audit: auditStats,
      license: licenseStatus,
      recentActivity,
      employeeOverview: employeeOverviewList,
      generatedAt: new Date().toISOString(),
    };

    // 9. Cache in Redis (30s TTL)
    if (redis && redis.status === 'ready') {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', DASHBOARD_CACHE_TTL_SECONDS);
      } catch (err) {
        ApiLogger.warn('AdminDashboardService', `Redis cache write error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }
}
