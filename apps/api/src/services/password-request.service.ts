import mongoose from 'mongoose';
import {
  PasswordRequestListItem,
  PasswordRequestOverviewResponse,
  PasswordRequestStatus,
  PasswordRequestType,
  SubmitForgotPasswordRequestDto,
  SubmitPasswordChangeRequestDto,
} from '@credential-manager/types';
import { AUTH_CONFIG } from '@credential-manager/config';
import { PasswordRequestModel, IPasswordRequestDocument } from '../models/password-request.model.js';
import { UserModel, IUserDocument } from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';
import { SessionService } from './session.service.js';
import { EmailService } from './email/email.service.js';

interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class PasswordRequestService {
  /**
   * Submits a password change request from an authenticated user (Settings).
   */
  public static async submitChangeRequest(
    userId: string,
    dto: SubmitPasswordChangeRequestDto,
    context?: AuditContext
  ): Promise<{ success: boolean; message: string; requestId: string }> {
    if (!dto.newPassword || dto.newPassword.length < AUTH_CONFIG.passwordMinLength) {
      throw AppError.badRequest(
        `New password must be at least ${AUTH_CONFIG.passwordMinLength} characters long.`
      );
    }

    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User account not found.');
    }

    if (user.status === 'SUSPENDED' || user.status === 'DISABLED' || user.status === 'REJECTED') {
      throw AppError.forbidden('Your account status does not allow password change requests.');
    }

    if (user.passwordHash) {
      const isCurrentValid = await verifyPassword(dto.currentPassword || '', user.passwordHash);
      if (!isCurrentValid) {
        throw AppError.badRequest('Current password is incorrect.');
      }

      const isSamePassword = await verifyPassword(dto.newPassword, user.passwordHash);
      if (isSamePassword) {
        throw AppError.badRequest('New password cannot be the same as your current password.');
      }
    }

    const newPasswordHash = await hashPassword(dto.newPassword);

    // Cancel / archive any prior pending request
    await PasswordRequestModel.updateMany(
      { userId: user._id, status: 'PENDING' },
      {
        $set: {
          status: 'REJECTED',
          adminNote: 'Superseded by a new password change request.',
          reviewedAt: new Date(),
          reviewedByName: 'System',
        },
      }
    );

    const requestDoc = await PasswordRequestModel.create({
      userId: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      department: user.department || '',
      requestType: 'PASSWORD_CHANGE',
      newPasswordHash,
      status: 'PENDING',
      reason: dto.reason?.trim() || 'User requested password change from Account Settings.',
      requestedAt: new Date(),
    });

    ApiLogger.info(
      'PasswordRequestService',
      `Password change request submitted for user [${user.employeeId}] ${user.email}`
    );

    await AuditService.record({
      action: 'PASSWORD_CHANGE_REQUESTED',
      category: 'USER_MANAGEMENT',
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      targetUserId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: user.employeeId,
        email: user.email,
        requestType: 'PASSWORD_CHANGE',
        description: 'Password change request submitted, awaiting admin approval.',
      },
    });

    return {
      success: true,
      message:
        'Your password change request has been submitted to the administrator for review. Your current password remains active until approved.',
      requestId: requestDoc._id.toString(),
    };
  }

  /**
   * Submits a forgot-password reset request from the public login screen.
   */
  public static async submitForgotPasswordRequest(
    dto: SubmitForgotPasswordRequestDto,
    context?: AuditContext
  ): Promise<{ success: boolean; message: string }> {
    const rawIdentifier = (dto.emailOrEmployeeId || '').trim();
    if (!rawIdentifier) {
      throw AppError.badRequest('Email address or Employee ID is required.');
    }

    if (!dto.newPassword || dto.newPassword.length < AUTH_CONFIG.passwordMinLength) {
      throw AppError.badRequest(
        `New password must be at least ${AUTH_CONFIG.passwordMinLength} characters long.`
      );
    }

    const user = await UserModel.findOne({
      $or: [
        { email: rawIdentifier.toLowerCase() },
        { employeeId: rawIdentifier.toUpperCase() },
      ],
    }).select('+passwordHash');

    // Return friendly generic response if user not found to avoid user enumeration
    if (!user) {
      ApiLogger.warn('PasswordRequestService', `Forgot password requested for non-existent user: ${rawIdentifier}`);
      return {
        success: true,
        message:
          'If an account matches your details, your password reset request has been submitted to the administrator for review.',
      };
    }

    if (user.status === 'REJECTED' || user.status === 'DISABLED') {
      ApiLogger.warn(
        'PasswordRequestService',
        `Forgot password requested for ${user.status} user [${user.employeeId}]`
      );
      return {
        success: true,
        message:
          'If an account matches your details, your password reset request has been submitted to the administrator for review.',
      };
    }

    const newPasswordHash = await hashPassword(dto.newPassword);

    // Cancel prior pending requests
    await PasswordRequestModel.updateMany(
      { userId: user._id, status: 'PENDING' },
      {
        $set: {
          status: 'REJECTED',
          adminNote: 'Superseded by a new password reset request.',
          reviewedAt: new Date(),
          reviewedByName: 'System',
        },
      }
    );

    await PasswordRequestModel.create({
      userId: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      department: user.department || '',
      requestType: 'FORGOT_PASSWORD',
      newPasswordHash,
      status: 'PENDING',
      reason: dto.reason?.trim() || 'User requested password reset from login screen.',
      requestedAt: new Date(),
    });

    ApiLogger.info(
      'PasswordRequestService',
      `Forgot password reset request submitted for user [${user.employeeId}] ${user.email}`
    );

    await AuditService.record({
      action: 'FORGOT_PASSWORD_REQUESTED',
      category: 'AUTHENTICATION',
      actorId: 'SYSTEM',
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      targetUserId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: user.employeeId,
        email: user.email,
        requestType: 'FORGOT_PASSWORD',
        description: 'Forgot password reset request submitted, awaiting admin approval.',
      },
    });

    return {
      success: true,
      message:
        'Your password reset request has been submitted to the administrator for approval. You will receive an email once approved.',
    };
  }

  /**
   * Retrieves paginated, filterable list of password requests for administrators.
   */
  public static async listRequests(query: {
    status?: PasswordRequestStatus;
    requestType?: PasswordRequestType;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PasswordRequestOverviewResponse> {
    const filter: Record<string, unknown> = {};

    if (query.status && query.status !== ('ALL' as unknown)) {
      filter.status = query.status;
    }

    if (query.requestType && query.requestType !== ('ALL' as unknown)) {
      filter.requestType = query.requestType;
    }

    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { employeeId: regex },
        { department: regex },
        { reason: regex },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [docs, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      PasswordRequestModel.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(limit).lean(),
      PasswordRequestModel.countDocuments(filter),
      PasswordRequestModel.countDocuments({ status: 'PENDING' }),
      PasswordRequestModel.countDocuments({ status: 'APPROVED' }),
      PasswordRequestModel.countDocuments({ status: 'REJECTED' }),
    ]);

    const requests: PasswordRequestListItem[] = docs.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId ? doc.userId.toString() : '',
      employeeId: doc.employeeId,
      name: doc.name,
      email: doc.email,
      department: doc.department || '',
      requestType: doc.requestType,
      status: doc.status,
      reason: doc.reason || '',
      requestedAt: doc.requestedAt ? new Date(doc.requestedAt).toISOString() : '',
      reviewedBy: doc.reviewedBy || '',
      reviewedByName: doc.reviewedByName || '',
      reviewedAt: doc.reviewedAt ? new Date(doc.reviewedAt).toISOString() : undefined,
      adminNote: doc.adminNote || '',
    }));

    return {
      requests,
      total,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }

  /**
   * Approves a pending password change/reset request.
   */
  public static async approveRequest(
    requestId: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw AppError.badRequest('Invalid password request ID format.');
    }

    const requestDoc = await PasswordRequestModel.findById(requestId).select('+newPasswordHash');
    if (!requestDoc) {
      throw AppError.notFound('Password request not found.');
    }

    if (requestDoc.status !== 'PENDING') {
      throw AppError.badRequest(
        `This request has already been ${requestDoc.status.toLowerCase()} and cannot be modified.`
      );
    }

    const user = await UserModel.findById(requestDoc.userId);
    if (!user) {
      throw AppError.notFound('Associated user account was not found.');
    }

    // Apply the new password hash
    user.passwordHash = requestDoc.newPasswordHash;
    user.passwordChangedAt = new Date();
    if (user.status === 'APPROVED' || user.status === 'SUSPENDED') {
      user.status = 'ACTIVE';
    }
    await user.save();

    // Invalidate all active sessions for this user across all devices
    await SessionService.revokeAllUserSessions(user.id);

    // Update the request record
    requestDoc.status = 'APPROVED';
    requestDoc.reviewedBy = adminUser.employeeId || adminUser.id;
    requestDoc.reviewedByName = adminUser.name || 'Administrator';
    requestDoc.reviewedAt = new Date();
    await requestDoc.save();

    ApiLogger.info(
      'PasswordRequestService',
      `Password request [${requestDoc.requestType}] for [${user.employeeId}] ${user.email} approved by ${adminUser.email || adminUser.id}`
    );

    // Send confirmation email to the employee
    try {
      await EmailService.sendPasswordRequestApprovedEmail({
        recipientEmail: user.email,
        employeeName: user.name,
        requestType: requestDoc.requestType,
      });
    } catch (emailErr) {
      ApiLogger.error(
        'PasswordRequestService',
        `Failed to send password approval confirmation email: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
      );
    }

    await AuditService.record({
      action: requestDoc.requestType === 'FORGOT_PASSWORD' ? 'PASSWORD_RESET_APPROVED' : 'PASSWORD_CHANGE_APPROVED',
      category: 'USER_MANAGEMENT',
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorName: adminUser.name || adminUser.employeeId,
      actorRole: 'ADMIN',
      targetUserId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: user.employeeId,
        email: user.email,
        requestId: requestDoc.id,
        requestType: requestDoc.requestType,
        description: 'Password change/reset request approved by administrator.',
      },
    });

    return {
      success: true,
      message: `Password request for ${user.name} approved successfully. Confirmation email sent.`,
    };
  }

  /**
   * Rejects a pending password change/reset request.
   */
  public static async rejectRequest(
    requestId: string,
    reason: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw AppError.badRequest('Invalid password request ID format.');
    }

    const requestDoc = await PasswordRequestModel.findById(requestId);
    if (!requestDoc) {
      throw AppError.notFound('Password request not found.');
    }

    if (requestDoc.status !== 'PENDING') {
      throw AppError.badRequest(
        `This request has already been ${requestDoc.status.toLowerCase()} and cannot be modified.`
      );
    }

    requestDoc.status = 'REJECTED';
    requestDoc.adminNote = reason?.trim() || '';
    requestDoc.reviewedBy = adminUser.employeeId || adminUser.id;
    requestDoc.reviewedByName = adminUser.name || 'Administrator';
    requestDoc.reviewedAt = new Date();
    await requestDoc.save();

    ApiLogger.info(
      'PasswordRequestService',
      `Password request [${requestDoc.requestType}] for [${requestDoc.employeeId}] ${requestDoc.email} rejected by ${adminUser.email || adminUser.id}`
    );

    // Send rejection notice email
    try {
      await EmailService.sendPasswordRequestRejectedEmail({
        recipientEmail: requestDoc.email,
        employeeName: requestDoc.name,
        requestType: requestDoc.requestType,
        adminNote: reason?.trim() || undefined,
      });
    } catch (emailErr) {
      ApiLogger.error(
        'PasswordRequestService',
        `Failed to send password rejection notice email: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
      );
    }

    await AuditService.record({
      action: requestDoc.requestType === 'FORGOT_PASSWORD' ? 'PASSWORD_RESET_REJECTED' : 'PASSWORD_CHANGE_REJECTED',
      category: 'USER_MANAGEMENT',
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorName: adminUser.name || adminUser.employeeId,
      actorRole: 'ADMIN',
      targetUserId: requestDoc.userId ? requestDoc.userId.toString() : undefined,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: requestDoc.employeeId,
        email: requestDoc.email,
        requestId: requestDoc.id,
        requestType: requestDoc.requestType,
        reason: reason?.trim() || 'No reason provided',
        description: 'Password change/reset request rejected by administrator.',
      },
    });

    return {
      success: true,
      message: `Password request for ${requestDoc.name} has been rejected. Notification sent.`,
    };
  }

  /**
   * Retrieves any active pending request for a user.
   */
  public static async getUserPendingRequest(userId: string): Promise<{
    hasPending: boolean;
    request?: PasswordRequestListItem;
  }> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { hasPending: false };
    }

    const doc = await PasswordRequestModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'PENDING',
    }).sort({ requestedAt: -1 }).lean();

    if (!doc) {
      return { hasPending: false };
    }

    return {
      hasPending: true,
      request: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        employeeId: doc.employeeId,
        name: doc.name,
        email: doc.email,
        department: doc.department || '',
        requestType: doc.requestType,
        status: doc.status,
        reason: doc.reason || '',
        requestedAt: new Date(doc.requestedAt).toISOString(),
      },
    };
  }
}
