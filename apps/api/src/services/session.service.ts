import crypto from 'crypto';
import { AuthSession, UserRole } from '@credential-manager/types';
import { AUTH_CONFIG } from '@credential-manager/config';
import { getRedisClient } from '../infrastructure/redis/redis.js';
import { ApiLogger } from '../utils/logger.js';

const SESSION_KEY_PREFIX = 'auth:refresh:';
const USER_SESSIONS_PREFIX = 'auth:user_sessions:';

// In-memory fallback store when Redis is offline
const memoryStore = new Map<string, { session: AuthSession; expiresAtEpoch: number }>();
const userSessionsMap = new Map<string, Set<string>>();

export class SessionService {
  /**
   * Create a new refresh session and store it in Redis (or memory fallback)
   */
  static async createSession(
    userId: string,
    employeeId: string,
    role: UserRole
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const ttlSeconds = AUTH_CONFIG.refreshTokenTtlSeconds;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const session: AuthSession = {
      sessionId,
      userId,
      employeeId,
      role,
      createdAt: now.toISOString(),
      expiresAt,
    };

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const sessionKey = `${SESSION_KEY_PREFIX}${sessionId}`;
        const userSetKey = `${USER_SESSIONS_PREFIX}${userId}`;

        await redis
          .multi()
          .set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds)
          .sadd(userSetKey, sessionId)
          .expire(userSetKey, ttlSeconds)
          .exec();

        return sessionId;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ApiLogger.warn('SessionService', `Redis write failed, falling back to memory store: ${msg}`);
      }
    }

    // In-memory fallback
    memoryStore.set(sessionId, {
      session,
      expiresAtEpoch: Date.now() + ttlSeconds * 1000,
    });

    if (!userSessionsMap.has(userId)) {
      userSessionsMap.set(userId, new Set());
    }
    userSessionsMap.get(userId)!.add(sessionId);

    return sessionId;
  }

  /**
   * Validate and retrieve an active refresh session
   */
  static async validateSession(sessionId: string): Promise<AuthSession | null> {
    if (!sessionId) return null;

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const data = await redis.get(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (data) {
          return JSON.parse(data) as AuthSession;
        }
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ApiLogger.warn('SessionService', `Redis read error, checking memory store: ${msg}`);
      }
    }

    // Check memory store
    const item = memoryStore.get(sessionId);
    if (item) {
      if (Date.now() > item.expiresAtEpoch) {
        memoryStore.delete(sessionId);
        return null;
      }
      return item.session;
    }

    return null;
  }

  /**
   * Rotate a session: Revoke old session and generate a fresh one
   */
  static async rotateSession(
    oldSessionId: string,
    userId: string,
    employeeId: string,
    role: UserRole
  ): Promise<string> {
    await this.revokeSession(oldSessionId);
    return this.createSession(userId, employeeId, role);
  }

  /**
   * Revoke a single refresh session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const data = await redis.get(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (data) {
          const session = JSON.parse(data) as AuthSession;
          await redis
            .multi()
            .del(`${SESSION_KEY_PREFIX}${sessionId}`)
            .srem(`${USER_SESSIONS_PREFIX}${session.userId}`, sessionId)
            .exec();
        } else {
          await redis.del(`${SESSION_KEY_PREFIX}${sessionId}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ApiLogger.warn('SessionService', `Redis delete error: ${msg}`);
      }
    }

    const item = memoryStore.get(sessionId);
    if (item) {
      const userSessions = userSessionsMap.get(item.session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
      }
      memoryStore.delete(sessionId);
    }
  }

  /**
   * Revoke all active sessions for a user (e.g. upon password change)
   */
  static async revokeAllUserSessions(userId: string): Promise<void> {
    if (!userId) return;

    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      try {
        const userSetKey = `${USER_SESSIONS_PREFIX}${userId}`;
        const sessionIds = await redis.smembers(userSetKey);
        if (sessionIds && sessionIds.length > 0) {
          const keys = sessionIds.map((id) => `${SESSION_KEY_PREFIX}${id}`);
          await redis.del(...keys);
        }
        await redis.del(userSetKey);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ApiLogger.warn('SessionService', `Redis revokeAll error: ${msg}`);
      }
    }

    const sessionIds = userSessionsMap.get(userId);
    if (sessionIds) {
      for (const id of sessionIds) {
        memoryStore.delete(id);
      }
      userSessionsMap.delete(userId);
    }
  }
}

