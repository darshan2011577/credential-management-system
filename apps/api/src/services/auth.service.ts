import { AuthTokens, SafeUser } from '@credential-manager/types';
import { AUTH_CONFIG } from '@credential-manager/config';
import { toPublicUser } from '../models/user.model.js';
import { UserService } from './user.service.js';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export interface LoginResult {
  user: SafeUser;
  tokens: AuthTokens;
}

export class AuthService {
  /**
   * Authenticate user credentials, check active status, and establish a secure session
   */
  static async login(email: string, plainPassword: string): Promise<LoginResult> {
    const normalizedEmail = (email || '').trim().toLowerCase();

    const user = await UserService.findUserByEmail(normalizedEmail, true);
    if (!user) {
      ApiLogger.warn('Auth', `Failed login attempt for unknown email: [${normalizedEmail}]`);
      throw AppError.unauthorized('Invalid email or password.');
    }

    if (user.status === 'PENDING') {
      ApiLogger.warn('Auth', `Login rejected: Pending approval for user [${user.employeeId}]`);
      throw AppError.forbidden('Your account is waiting for administrator approval.');
    }

    if (user.status === 'REJECTED') {
      ApiLogger.warn('Auth', `Login rejected: Rejected registration for user [${user.employeeId}]`);
      throw AppError.forbidden(
        'Your registration has not been approved. Please contact the administrator if you need assistance.'
      );
    }

    if (user.status === 'APPROVED' && user.credentialDeliveryStatus === 'NOT_SENT') {
      ApiLogger.warn('Auth', `Login rejected: Approved but credentials not delivered for user [${user.employeeId}]`);
      throw AppError.forbidden('Your account has been approved. Please wait for your login credentials.');
    }

    if (user.status === 'SUSPENDED') {
      ApiLogger.warn('Auth', `Login rejected: Suspended account for user [${user.employeeId}]`);
      throw AppError.forbidden(
        'Your account is currently suspended. Please contact your administrator.'
      );
    }

    if (user.status === 'DISABLED' || user.status === 'INACTIVE') {
      ApiLogger.warn('Auth', `Login rejected for ${user.status} user [${user.employeeId}]`);
      throw AppError.forbidden(
        'Your account is currently disabled. Please contact the administrator.'
      );
    }

    if (!user.passwordHash) {
      ApiLogger.warn('Auth', `Login rejected: No password hash established for user [${user.employeeId}]`);
      throw AppError.forbidden('Your account has been approved. Please wait for your login credentials.');
    }

    const isValidPassword = await verifyPassword(plainPassword, user.passwordHash);
    if (!isValidPassword) {
      ApiLogger.warn('Auth', `Invalid password entered for user [${user.employeeId}]`);
      throw AppError.unauthorized('Invalid email or password.');
    }

    // Promote APPROVED user to ACTIVE status upon first successful login
    if (user.status === 'APPROVED') {
      user.status = 'ACTIVE';
      await user.save().catch((err) => {
        ApiLogger.warn('Auth', `Failed to update user status to ACTIVE:`, err);
      });
    }

    // Update last login timestamp asynchronously
    UserService.recordLogin(user.id).catch((err) => {
      ApiLogger.warn('Auth', `Failed to record last login for user ${user.id}:`, err);
    });

    // Create refresh session in Redis
    const sessionId = await SessionService.createSession(user.id, user.employeeId, user.role);

    // Issue tokens
    const accessToken = TokenService.createAccessToken({
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
    });

    const refreshToken = TokenService.createRefreshToken({
      sub: user.id,
      sessionId,
    });

    ApiLogger.info('Auth', `Successful login for user [${user.employeeId}] (${user.role})`);

    return {
      user: toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      },
    };
  }

  /**
   * Validate refresh token, rotate Redis session, and generate fresh tokens
   */
  static async refresh(refreshToken: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required.');
    }

    const decoded = TokenService.verifyRefreshToken(refreshToken);

    const session = await SessionService.validateSession(decoded.sessionId);
    if (!session) {
      ApiLogger.warn('Auth', `Refresh failed: session [${decoded.sessionId}] revoked or expired.`);
      throw AppError.unauthorized('Refresh session has expired or was revoked. Please log in again.');
    }

    const user = await UserService.findUserById(session.userId);
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'APPROVED')) {
      await SessionService.revokeSession(decoded.sessionId);
      throw AppError.unauthorized('User account is invalid or no longer active.');
    }

    // Rotate session: invalidate previous session ID and create a fresh one
    const newSessionId = await SessionService.rotateSession(
      decoded.sessionId,
      user.id,
      user.employeeId,
      user.role
    );

    const newAccessToken = TokenService.createAccessToken({
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
    });

    const newRefreshToken = TokenService.createRefreshToken({
      sub: user.id,
      sessionId: newSessionId,
    });

    return {
      user: toPublicUser(user),
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  /**
   * Invalidate active refresh session on logout
   */
  static async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const decoded = TokenService.verifyRefreshToken(refreshToken);
      if (decoded.sessionId) {
        await SessionService.revokeSession(decoded.sessionId);
        ApiLogger.info('Auth', `Session [${decoded.sessionId}] revoked on logout.`);
      }
    } catch {
      // Ignore token decoding errors on logout
    }
  }

  /**
   * Update password, verify current password, and invalidate all existing refresh sessions
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!newPassword || newPassword.length < AUTH_CONFIG.passwordMinLength) {
      throw AppError.badRequest(
        `New password must be at least ${AUTH_CONFIG.passwordMinLength} characters long.`
      );
    }

    const user = await UserService.findUserById(userId, true);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw AppError.badRequest('Current password is incorrect.');
    }

    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw AppError.badRequest('New password cannot be the same as the current password.');
    }

    const newPasswordHash = await hashPassword(newPassword);
    await UserService.updatePassword(userId, newPasswordHash);

    // Invalidate all active sessions for this user across all devices
    await SessionService.revokeAllUserSessions(userId);

    ApiLogger.info('Auth', `Password successfully changed for user [${user.employeeId}]. All active sessions revoked.`);
  }

  /**
   * Retrieve current authenticated user profile
   */
  static async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await UserService.findUserById(userId);
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'APPROVED')) {
      throw AppError.unauthorized('User session is invalid or account is not active.');
    }

    return toPublicUser(user);
  }
}
