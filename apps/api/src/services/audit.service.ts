import mongoose from 'mongoose';
import {
  AuditLogPaginationResult,
  AuditLogQuery,
  CreateAuditLogDto,
  IAuditLog,
} from '@credential-manager/types';
import { AUDIT_CONFIG } from '@credential-manager/config';
import { AuditLogModel } from '../models/audit-log.model.js';
import { sanitizeAuditMetadata } from '../utils/audit-sanitizer.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export class AuditService {
  /**
   * Records an immutable security audit event with recursive secret sanitization.
   */
  public static async record(entry: CreateAuditLogDto): Promise<IAuditLog> {
    try {
      // 1. Recursively sanitize metadata to remove prohibited secrets
      const cleanMetadata = sanitizeAuditMetadata(entry.metadata);

      // 2. Build audit log document
      const doc = await AuditLogModel.create({
        actorId: entry.actorId && mongoose.Types.ObjectId.isValid(entry.actorId)
          ? new mongoose.Types.ObjectId(entry.actorId)
          : undefined,
        actorRole: entry.actorRole || 'SYSTEM',
        actorEmail: entry.actorEmail,
        actorName: entry.actorName,
        action: entry.action,
        category: entry.category,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        targetUserId: entry.targetUserId && mongoose.Types.ObjectId.isValid(entry.targetUserId)
          ? new mongoose.Types.ObjectId(entry.targetUserId)
          : undefined,
        result: entry.result || 'SUCCESS',
        ipAddress: entry.ipAddress || '127.0.0.1',
        userAgent: entry.userAgent ? entry.userAgent.substring(0, 500) : undefined,
        requestId: entry.requestId,
        metadata: cleanMetadata,
      });

      ApiLogger.info(
        'AuditService',
        `Audit Log Recorded: [${entry.category}] [${entry.action}] [Result: ${entry.result || 'SUCCESS'}] [Actor: ${entry.actorEmail || entry.actorId || 'SYSTEM'}] [ReqID: ${entry.requestId || 'N/A'}]`
      );

      return doc.toSafeAuditLog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown audit persistence error';
      ApiLogger.error('AuditService', `Failed to write audit log entry [${entry.action}]: ${msg}`);
      // Return a transient representation so caller business flows are not blocked
      return {
        id: new mongoose.Types.ObjectId().toString(),
        actorId: entry.actorId,
        actorRole: entry.actorRole || 'SYSTEM',
        actorEmail: entry.actorEmail,
        actorName: entry.actorName,
        action: entry.action,
        category: entry.category,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        targetUserId: entry.targetUserId,
        result: entry.result || 'SUCCESS',
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
        metadata: entry.metadata,
        createdAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Retrieves paginated, filtered audit logs for Admin inspection.
   */
  public static async listLogs(query: AuditLogQuery): Promise<AuditLogPaginationResult> {
    const page = Math.max(1, query.page || AUDIT_CONFIG.defaultPage);
    const limit = Math.min(Math.max(1, query.limit || AUDIT_CONFIG.defaultLimit), AUDIT_CONFIG.maxLimit);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.action) {
      filter.action = query.action;
    }

    if (query.result) {
      filter.result = query.result;
    }

    if (query.actorId && mongoose.Types.ObjectId.isValid(query.actorId)) {
      filter.actorId = new mongoose.Types.ObjectId(query.actorId);
    }

    if (query.targetUserId && mongoose.Types.ObjectId.isValid(query.targetUserId)) {
      filter.targetUserId = new mongoose.Types.ObjectId(query.targetUserId);
    }

    if (query.resourceType) {
      filter.resourceType = query.resourceType;
    }

    if (query.resourceId) {
      filter.resourceId = query.resourceId;
    }

    // Date range filtering
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) {
        filter.createdAt.$gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        // Include full day if date string only (YYYY-MM-DD)
        if (query.to.length <= 10) {
          toDate.setUTCHours(23, 59, 59, 999);
        }
        filter.createdAt.$lte = toDate;
      }
    }

    // Keyword search across actions, actorEmail, actorName, resourceType, and requestId
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { action: searchRegex },
        { actorEmail: searchRegex },
        { actorName: searchRegex },
        { resourceType: searchRegex },
        { requestId: searchRegex },
        { ipAddress: searchRegex },
      ];
    }

    const [docs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      AuditLogModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: docs.map((doc) => doc.toSafeAuditLog()),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single audit log record by ID.
   */
  public static async getLogById(id: string): Promise<IAuditLog> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid audit log identifier format.');
    }

    const doc = await AuditLogModel.findById(id).exec();
    if (!doc) {
      throw AppError.notFound('Audit log record not found.');
    }

    return doc.toSafeAuditLog();
  }
}
