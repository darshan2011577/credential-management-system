import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { AUTH_CONFIG } from '@credential-manager/config';
import { AuthService } from '../services/auth.service.js';
import { RegistrationService } from '../services/registration.service.js';
import { AuditService } from '../services/audit.service.js';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
} from '../config/cookie.config.js';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Public registration request submission for prospective employees.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await RegistrationService.submitRegistration(req.body, {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(201).json(
        createSuccessResponse(
          { user },
          'Your registration has been submitted successfully. Your account is currently waiting for approval.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, tokens } = await AuthService.login(email, password);

      // Record successful login audit event
      AuditService.record({
        actorId: user.id,
        actorRole: user.role,
        actorEmail: user.email,
        actorName: user.name,
        action: 'LOGIN_SUCCESS',
        category: 'AUTHENTICATION',
        resourceType: 'User',
        resourceId: user.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          employeeId: user.employeeId,
          department: user.department,
        },
      }).catch(() => {});

      // Set secure HTTP-only cookies
      res.cookie(
        AUTH_CONFIG.cookieNames.accessToken,
        tokens.accessToken,
        getAccessTokenCookieOptions()
      );
      res.cookie(
        AUTH_CONFIG.cookieNames.refreshToken,
        tokens.refreshToken,
        getRefreshTokenCookieOptions()
      );

      res.status(200).json(
        createSuccessResponse(
          { user },
          'Login successful. Welcome to Credential Manager.',
          req.id
        )
      );
    } catch (error) {
      // Record failed login audit event (Strictly WITHOUT saving any password)
      AuditService.record({
        actorRole: 'SYSTEM',
        action: 'LOGIN_FAILED',
        category: 'AUTHENTICATION',
        result: 'FAILURE',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          attemptedEmail: req.body?.email ? String(req.body.email).toLowerCase() : undefined,
          reason: 'INVALID_CREDENTIALS',
        },
      }).catch(() => {});

      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        (req.cookies && req.cookies[AUTH_CONFIG.cookieNames.refreshToken]) ||
        req.body?.refreshToken;

      const { user, tokens } = await AuthService.refresh(refreshToken);

      AuditService.record({
        actorId: user.id,
        actorRole: user.role,
        actorEmail: user.email,
        actorName: user.name,
        action: 'TOKEN_REFRESH',
        category: 'AUTHENTICATION',
        resourceType: 'User',
        resourceId: user.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      }).catch(() => {});

      res.cookie(
        AUTH_CONFIG.cookieNames.accessToken,
        tokens.accessToken,
        getAccessTokenCookieOptions()
      );
      res.cookie(
        AUTH_CONFIG.cookieNames.refreshToken,
        tokens.refreshToken,
        getRefreshTokenCookieOptions()
      );

      res.status(200).json(
        createSuccessResponse(
          { user },
          'Session refreshed successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        (req.cookies && req.cookies[AUTH_CONFIG.cookieNames.refreshToken]) ||
        req.body?.refreshToken;

      await AuthService.logout(refreshToken);

      if (req.user) {
        AuditService.record({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'LOGOUT',
          category: 'AUTHENTICATION',
          resourceType: 'User',
          resourceId: req.user.id,
          result: 'SUCCESS',
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }).catch(() => {});
      }

      // Clear authentication cookies
      res.clearCookie(
        AUTH_CONFIG.cookieNames.accessToken,
        getClearCookieOptions('/')
      );
      res.clearCookie(
        AUTH_CONFIG.cookieNames.refreshToken,
        getClearCookieOptions('/api/v1/auth')
      );

      res.status(200).json(
        createSuccessResponse(
          null,
          'Logged out successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const user = await AuthService.getCurrentUser(userId);

      res.status(200).json(
        createSuccessResponse(
          { user },
          'User profile retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await AuthService.changePassword(userId, currentPassword, newPassword);

      AuditService.record({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'PASSWORD_CHANGE',
        category: 'AUTHENTICATION',
        resourceType: 'User',
        resourceId: req.user!.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      }).catch(() => {});

      // Clear cookies after password change to enforce clean re-authentication
      res.clearCookie(
        AUTH_CONFIG.cookieNames.accessToken,
        getClearCookieOptions('/')
      );
      res.clearCookie(
        AUTH_CONFIG.cookieNames.refreshToken,
        getClearCookieOptions('/api/v1/auth')
      );

      res.status(200).json(
        createSuccessResponse(
          null,
          'Password changed successfully. Please log in with your new password.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
