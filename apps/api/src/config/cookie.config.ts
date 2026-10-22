import { CookieOptions } from 'express';
import { AUTH_CONFIG } from '@credential-manager/config';
import { env } from './env.js';

export function getAccessTokenCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  };
}

export function getRefreshTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: AUTH_CONFIG.refreshTokenTtlSeconds * 1000, // 7 days
    path: '/api/v1/auth', // Restricted to auth paths
  };
}

export function getClearCookieOptions(path: string = '/'): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path,
  };
}
