import jwt from 'jsonwebtoken';
import { JwtAccessPayload, JwtRefreshPayload, UserRole } from '@credential-manager/types';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export class TokenService {
  /**
   * Generate short-lived JWT Access Token (15m)
   */
  static createAccessToken(payload: { sub: string; employeeId: string; role: UserRole }): string {
    return jwt.sign(
      {
        sub: payload.sub,
        employeeId: payload.employeeId,
        role: payload.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        issuer: 'credential-manager-api',
        audience: 'credential-manager-client',
      }
    );
  }

  /**
   * Verify and decode JWT Access Token
   */
  static verifyAccessToken(token: string): JwtAccessPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'credential-manager-api',
        audience: 'credential-manager-client',
      }) as JwtAccessPayload;

      return decoded;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Access token has expired. Please refresh your session.');
      }
      throw AppError.unauthorized('Invalid or malformed access token.');
    }
  }

  /**
   * Generate long-lived JWT Refresh Token (7d) referencing Redis session
   */
  static createRefreshToken(payload: { sub: string; sessionId: string }): string {
    return jwt.sign(
      {
        sub: payload.sub,
        sessionId: payload.sessionId,
      },
      env.JWT_REFRESH_SECRET,
      {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        issuer: 'credential-manager-api',
        audience: 'credential-manager-client',
      }
    );
  }

  /**
   * Verify and decode JWT Refresh Token
   */
  static verifyRefreshToken(token: string): JwtRefreshPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        issuer: 'credential-manager-api',
        audience: 'credential-manager-client',
      }) as JwtRefreshPayload;

      return decoded;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Refresh session has expired. Please log in again.');
      }
      throw AppError.unauthorized('Invalid or malformed refresh token.');
    }
  }
}
