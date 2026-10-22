import mongoose from 'mongoose';
import {
  RegisterDto,
  RegistrationListItem,
  RegistrationListQuery,
  RegistrationPaginationResult,
  SafeUser,
} from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';
import { IUserDocument, toPublicUser, UserModel } from '../models/user.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { CredentialShareModel } from '../models/credential-share.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { PasswordGenerator } from '../utils/password-generator.js';
import { hashPassword } from '../utils/password.js';
import { EmailService } from './email/email.service.js';
import { NotificationService } from './notification.service.js';
import { AuditService } from './audit.service.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class RegistrationService {
  /**
   * Submits a new employee registration request with PENDING approval status.
   */
  public static async submitRegistration(
    dto: RegisterDto,
    context?: AuditContext
  ): Promise<SafeUser> {
    const normalizedEmail = (dto.email || '').trim().toLowerCase();
    const normalizedEmployeeId = (dto.employeeId || '').trim().toUpperCase();
    const normalizedName = (dto.name || '').trim();
    const normalizedPhone = (dto.phoneNumber || '').trim();
    const normalizedDepartment = (dto.department || '').trim();

    if (!normalizedEmail || !normalizedEmployeeId || !normalizedName) {
      throw AppError.badRequest('Please complete all required registration fields.');
    }

    // Duplicate Check: Check whether email is already associated with an existing account or pending registration
    const existingUserByEmail = await UserModel.findOne({ email: normalizedEmail });
    if (existingUserByEmail) {
      throw AppError.conflict('An account with this email address already exists or is awaiting approval.');
    }

    // Duplicate Check: Employee ID
    const existingUserByEmpId = await UserModel.findOne({ employeeId: normalizedEmployeeId });
    if (existingUserByEmpId) {
      throw AppError.conflict('An account with this Employee ID already exists or is awaiting approval.');
    }

    // Create user in PENDING status with no usable password
    const user = await UserModel.create({
      employeeId: normalizedEmployeeId,
      name: normalizedName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      department: normalizedDepartment,
      role: 'EMPLOYEE',
      status: 'PENDING',
      credentialDeliveryStatus: 'NOT_SENT',
      registeredAt: new Date(),
      passwordHash: '',
    });

    ApiLogger.info('RegistrationService', `New employee registration submitted: [${normalizedEmployeeId}] ${normalizedEmail}`);

    // Notify all system administrators
    try {
      const admins = await UserModel.find({ role: 'ADMIN', status: 'ACTIVE' });
      for (const admin of admins) {
        await NotificationService.createNotification({
          recipientId: admin.id,
          type: 'REGISTRATION_PENDING',
          title: 'New Employee Registration',
          message: 'New employee registration requires review.',
          relatedEntityType: 'User',
          relatedEntityId: user.id,
        }).catch((err) => {
          ApiLogger.warn('RegistrationService', `Failed to notify admin ${admin.id}: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    } catch (err) {
      ApiLogger.warn('RegistrationService', `Failed to dispatch admin registration notifications: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Record Security Audit Event
    await AuditService.record({
      action: 'REGISTRATION_SUBMITTED',
      category: 'USER_MANAGEMENT',
      actorName: normalizedName,
      actorEmail: normalizedEmail,
      actorRole: 'EMPLOYEE',
      targetUserId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: normalizedEmployeeId,
        email: normalizedEmail,
        department: normalizedDepartment,
      },
    });

    return toPublicUser(user);
  }

  /**
   * Lists registration requests with filtering and pagination for Administrator view.
   */
  public static async listRegistrations(
    query: RegistrationListQuery
  ): Promise<RegistrationPaginationResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.department && query.department !== 'ALL') {
      filter.department = query.department.trim();
    }

    if (query.search && query.search.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
        { department: searchRegex },
      ];
    }

    const [docs, total, pendingCount] = await Promise.all([
      UserModel.find(filter)
        .sort({ registeredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(filter),
      UserModel.countDocuments({ status: 'PENDING' }),
    ]);

    const registrations: RegistrationListItem[] = docs.map((doc) => {
      const safe = toPublicUser(doc);
      return {
        id: safe.id,
        employeeId: safe.employeeId,
        name: safe.name,
        email: safe.email,
        phoneNumber: safe.phoneNumber,
        department: safe.department,
        status: safe.status,
        credentialDeliveryStatus: safe.credentialDeliveryStatus || 'NOT_SENT',
        credentialsSentAt: safe.credentialsSentAt,
        registeredAt: safe.registeredAt || safe.createdAt,
        approvedAt: safe.approvedAt,
        approvedBy: safe.approvedBy,
        rejectionReason: safe.rejectionReason,
        createdAt: safe.createdAt,
      };
    });

    return {
      registrations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      pendingCount,
    };
  }

  /**
   * Retrieves single registration full details for Administrator modal view.
   */
  public static async getRegistrationDetails(id: string): Promise<RegistrationListItem> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid registration identifier format.');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('Registration record not found.');
    }

    const safe = toPublicUser(user);
    return {
      id: safe.id,
      employeeId: safe.employeeId,
      name: safe.name,
      email: safe.email,
      phoneNumber: safe.phoneNumber,
      department: safe.department,
      status: safe.status,
      credentialDeliveryStatus: safe.credentialDeliveryStatus || 'NOT_SENT',
      credentialsSentAt: safe.credentialsSentAt,
      registeredAt: safe.registeredAt || safe.createdAt,
      approvedAt: safe.approvedAt,
      approvedBy: safe.approvedBy,
      rejectionReason: safe.rejectionReason,
      createdAt: safe.createdAt,
    };
  }

  /**
   * Approves a pending employee registration, generates a secure temporary password,
   * hashes it into the user document, and prepares credential delivery.
   */
  public static async approveRegistration(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ user: SafeUser; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid registration identifier format.');
    }

    const user = await UserModel.findById(id).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('Registration record not found.');
    }

    if (user.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot approve account in "${user.status}" status.`);
    }

    // Generate secure temporary password using existing CSPRNG generator
    const temporaryPassword = PasswordGenerator.generate({
      length: 14,
      symbols: true,
      numbers: true,
      uppercase: true,
      lowercase: true,
    });

    // Hash the password securely using existing hashing mechanism (Argon2id/bcrypt)
    const securePasswordHash = await hashPassword(temporaryPassword);

    // Update account state
    user.status = 'APPROVED';
    user.passwordHash = securePasswordHash;
    user.approvedAt = new Date();
    user.approvedBy = adminUser.name || adminUser.employeeId || 'System Administrator';
    user.credentialDeliveryStatus = 'NOT_SENT';
    await user.save();

    ApiLogger.info('RegistrationService', `Employee registration approved: [${user.employeeId}] ${user.email} by ${adminUser.employeeId || adminUser.id}`);

    // Notify employee in-app
    await NotificationService.createNotification({
      recipientId: user.id,
      type: 'REGISTRATION_APPROVED',
      title: 'Account Approved',
      message: 'Your account has been approved.',
      relatedEntityType: 'User',
      relatedEntityId: user.id,
    }).catch((err) => {
      ApiLogger.warn('RegistrationService', `Failed to send in-app approval notification: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Record Security Audit Event (NEVER persist plaintext password or hash in audit log)
    await AuditService.record({
      action: 'REGISTRATION_APPROVED',
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
        department: user.department,
        description: 'Employee registration approved.',
      },
    });

    return {
      user: toPublicUser(user),
      message: 'Registration approved successfully.',
    };
  }

  /**
   * Generates a fresh temporary password and delivers login credentials via email to approved employee.
   * Fail-safe: if email fails, approval is NOT undone and delivery status is marked as FAILED with retry capability.
   */
  public static async sendCredentials(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ success: boolean; message: string; deliveryStatus: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid registration identifier format.');
    }

    const user = await UserModel.findById(id).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User account not found.');
    }

    if (user.status === 'PENDING') {
      throw AppError.badRequest('Please approve the registration before sending credentials.');
    }

    if (user.status === 'REJECTED' || user.status === 'DISABLED' || user.status === 'SUSPENDED') {
      throw AppError.badRequest(`Cannot send credentials to a ${user.status.toLowerCase()} account.`);
    }

    // Generate fresh cryptographically secure temporary password
    const temporaryPassword = PasswordGenerator.generate({
      length: 14,
      symbols: true,
      numbers: true,
      uppercase: true,
      lowercase: true,
    });

    // Securely hash and update in database
    const securePasswordHash = await hashPassword(temporaryPassword);
    user.passwordHash = securePasswordHash;
    user.credentialDeliveryStatus = 'SENDING';
    await user.save();

    // Dispatch email (Plaintext password exists ONLY in memory during this operation)
    const emailResult = await EmailService.sendLoginCredentialsEmail({
      recipientEmail: user.email,
      employeeName: user.name,
      temporaryPassword,
      applicationName: APP_CONFIG.appName,
    });

    if (emailResult.success) {
      user.credentialDeliveryStatus = 'SENT';
      user.credentialsSentAt = new Date();
      user.status = 'ACTIVE';
      await user.save();

      ApiLogger.info('RegistrationService', `Login credentials sent successfully to [${user.employeeId}] ${user.email}`);

      // In-app notification for employee
      await NotificationService.createNotification({
        recipientId: user.id,
        type: 'CREDENTIALS_DELIVERED',
        title: 'Login Credentials Sent',
        message: 'Your login credentials have been sent to your registered email address.',
        relatedEntityType: 'User',
        relatedEntityId: user.id,
      }).catch((err) => {
        ApiLogger.warn('RegistrationService', 'Failed to dispatch credentials notification:', err);
      });

      // Record Security Audit Event
      await AuditService.record({
        action: 'CREDENTIALS_SENT',
        category: 'USER_MANAGEMENT',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'ADMIN',
        targetUserId: user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        requestId: context?.requestId,
        result: 'SUCCESS',
        metadata: {
          employeeId: user.employeeId,
          email: user.email,
          description: 'Login credentials sent.',
        },
      });

      return {
        success: true,
        message: 'Login credentials were sent successfully.',
        deliveryStatus: 'SENT',
      };
    } else {
      user.credentialDeliveryStatus = 'FAILED';
      await user.save();

      ApiLogger.warn('RegistrationService', `Failed to send login credentials email to [${user.employeeId}] ${user.email}: ${emailResult.error}`);

      // Record Audit Event for failure
      await AuditService.record({
        action: 'CREDENTIALS_SENT',
        category: 'USER_MANAGEMENT',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'ADMIN',
        targetUserId: user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        requestId: context?.requestId,
        result: 'FAILURE',
        metadata: {
          employeeId: user.employeeId,
          email: user.email,
          description: 'Login credential email delivery failed.',
        },
      });

      return {
        success: false,
        message: emailResult.error
          ? `Email delivery failed (${emailResult.error}). Please verify your SMTP / Gmail credentials and try sending again.`
          : 'The account was approved, but the login email could not be sent. Please try sending the credentials again.',
        deliveryStatus: 'FAILED',
      };
    }
  }

  /**
   * Resends fresh login credentials by generating a new temporary password and dispatching email.
   */
  public static async resendCredentials(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ success: boolean; message: string; deliveryStatus: string }> {
    const result = await this.sendCredentials(id, adminUser, context);

    if (result.success) {
      await AuditService.record({
        action: 'CREDENTIALS_RESENT',
        category: 'USER_MANAGEMENT',
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorName: adminUser.name,
        actorRole: 'ADMIN',
        targetUserId: id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        requestId: context?.requestId,
        result: 'SUCCESS',
        metadata: {
          description: 'Login credentials resend requested.',
        },
      });
    }

    return result;
  }

  /**
   * Rejects a pending employee registration.
   */
  public static async rejectRegistration(
    id: string,
    reason: string | undefined,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ user: SafeUser; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid registration identifier format.');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('Registration record not found.');
    }

    if (user.status !== 'PENDING') {
      throw AppError.badRequest(`Only pending registrations can be rejected.`);
    }

    user.status = 'REJECTED';
    user.rejectionReason = (reason || '').trim();
    await user.save();

    ApiLogger.info('RegistrationService', `Registration rejected: [${user.employeeId}] ${user.email} by ${adminUser.email}`);

    // Record Security Audit Event
    await AuditService.record({
      action: 'REGISTRATION_REJECTED',
      category: 'USER_MANAGEMENT',
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorName: adminUser.name,
      actorRole: 'ADMIN',
      targetUserId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: user.employeeId,
        email: user.email,
        reason: reason || 'None provided',
        description: 'Employee registration rejected.',
      },
    });

    return {
      user: toPublicUser(user),
      message: 'Registration rejected successfully.',
    };
  }

  /**
   * Suspends an active or approved employee account, revoking their login ability immediately.
   */
  public static async suspendUser(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ user: SafeUser; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid user identifier format.');
    }

    if (adminUser.id === id) {
      throw AppError.badRequest('You cannot suspend your own administrator account.');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User record not found.');
    }

    if (user.role === 'ADMIN') {
      throw AppError.forbidden('Cannot suspend an administrator account.');
    }

    user.status = 'SUSPENDED';
    await user.save();

    ApiLogger.info('RegistrationService', `Account suspended: [${user.employeeId}] ${user.email} by ${adminUser.email || adminUser.id}`);

    await AuditService.record({
      action: 'USER_SUSPENDED',
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
        description: 'Employee account suspended.',
      },
    });

    return {
      user: toPublicUser(user),
      message: `Account for ${user.name} has been suspended.`,
    };
  }

  /**
   * Reactivates a suspended employee account.
   */
  public static async reactivateUser(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ user: SafeUser; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid user identifier format.');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User record not found.');
    }

    user.status = user.credentialDeliveryStatus === 'SENT' ? 'ACTIVE' : 'APPROVED';
    await user.save();

    ApiLogger.info('RegistrationService', `Account reactivated: [${user.employeeId}] ${user.email} by ${adminUser.email || adminUser.id}`);

    await AuditService.record({
      action: 'USER_REACTIVATED',
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
        status: user.status,
        description: 'Employee account reactivated.',
      },
    });

    return {
      user: toPublicUser(user),
      message: `Account for ${user.name} has been reactivated.`,
    };
  }

  /**
   * Permanently deletes an employee profile and cleans up associated credentials and shares.
   */
  public static async deleteUser(
    id: string,
    adminUser: { id: string; employeeId?: string; name?: string; email?: string },
    context?: AuditContext
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid user identifier format.');
    }

    if (adminUser.id === id) {
      throw AppError.badRequest('You cannot delete your own administrator account.');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User record not found.');
    }

    if (user.role === 'ADMIN') {
      throw AppError.forbidden('Cannot delete an administrator account.');
    }

    const userEmail = user.email;
    const userEmployeeId = user.employeeId;
    const userName = user.name;

    // Clean up related credentials, shares, and notifications
    await Promise.all([
      CredentialModel.deleteMany({ ownerId: id }),
      CredentialShareModel.deleteMany({ $or: [{ ownerId: id }, { recipientId: id }] }),
      NotificationModel.deleteMany({ recipientId: id }),
      UserModel.findByIdAndDelete(id),
    ]);

    ApiLogger.info('RegistrationService', `Employee profile deleted: [${userEmployeeId}] ${userEmail} by ${adminUser.email || adminUser.id}`);

    await AuditService.record({
      action: 'USER_DELETED',
      category: 'USER_MANAGEMENT',
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorName: adminUser.name || adminUser.employeeId,
      actorRole: 'ADMIN',
      targetUserId: id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      result: 'SUCCESS',
      metadata: {
        employeeId: userEmployeeId,
        email: userEmail,
        name: userName,
        description: 'Employee profile and associated vault items deleted.',
      },
    });

    return {
      success: true,
      message: `Profile for ${userName} (${userEmail}) was permanently deleted.`,
    };
  }
}

