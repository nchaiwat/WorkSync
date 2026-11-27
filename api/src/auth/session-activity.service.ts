import { Injectable } from '@nestjs/common';

export type RevokeReason = 'logout' | 'idle_timeout' | 'deactivated';

interface SessionEntry {
  lastActivityAt: number;
  userId: string;
  username?: string;
}

interface RevokedEntry {
  reason: RevokeReason;
  expiresAt: number;
}

@Injectable()
export class SessionActivityService {
  private readonly activeSessions = new Map<string, SessionEntry>();
  private readonly revokedSessions = new Map<string, RevokedEntry>();
  private readonly idleLogDedupe = new Map<string, number>();
  private lastCleanupAt = Date.now();

  private maybeCleanup(now: number): void {
    // Cleanup every 5 minutes to prevent unbounded map growth
    if (now - this.lastCleanupAt < 5 * 60 * 1000) return;
    this.lastCleanupAt = now;

    for (const [key, entry] of this.revokedSessions.entries()) {
      if (entry.expiresAt <= now) {
        this.revokedSessions.delete(key);
      }
    }
    const maxStaleMs = 24 * 60 * 60 * 1000;
    for (const [key, entry] of this.activeSessions.entries()) {
      if (now - entry.lastActivityAt > maxStaleMs) {
        this.activeSessions.delete(key);
      }
    }
    for (const [userKey, ts] of this.idleLogDedupe.entries()) {
      if (now - ts > 60 * 1000) {
        this.idleLogDedupe.delete(userKey);
      }
    }
  }

  startSession(sessionKey: string, userId: string, username?: string): void {
    const now = Date.now();
    this.maybeCleanup(now);
    this.revokedSessions.delete(sessionKey);
    this.activeSessions.set(sessionKey, {
      lastActivityAt: now,
      userId,
      username,
    });
  }

  touchSession(sessionKey: string, userId: string, username?: string): void {
    const now = Date.now();
    this.maybeCleanup(now);
    this.activeSessions.set(sessionKey, {
      lastActivityAt: now,
      userId,
      username,
    });
  }

  checkAndTouch(
    sessionKey: string,
    userId: string,
    username: string,
    idleLimitMinutes: number,
  ): { expired: boolean; reason?: RevokeReason } {
    const now = Date.now();
    this.maybeCleanup(now);

    const revoked = this.revokedSessions.get(sessionKey);
    if (revoked && revoked.expiresAt > now) {
      return { expired: true, reason: revoked.reason };
    }

    const entry = this.activeSessions.get(sessionKey);
    if (entry) {
      const limitMs = Math.max(1, idleLimitMinutes) * 60 * 1000;
      if (idleLimitMinutes > 0 && now - entry.lastActivityAt > limitMs) {
        this.activeSessions.delete(sessionKey);
        this.revokedSessions.set(sessionKey, {
          reason: 'idle_timeout',
          expiresAt: now + 24 * 60 * 60 * 1000,
        });
        return { expired: true, reason: 'idle_timeout' };
      }
    }

    // Initialize or slide lastActivityAt (safe for server restarts / legacy JWT without sid)
    this.activeSessions.set(sessionKey, {
      lastActivityAt: now,
      userId,
      username,
    });

    return { expired: false };
  }

  revokeSession(sessionKey: string, reason: RevokeReason = 'logout'): void {
    const now = Date.now();
    this.maybeCleanup(now);
    this.activeSessions.delete(sessionKey);
    this.revokedSessions.set(sessionKey, {
      reason,
      expiresAt: now + 24 * 60 * 60 * 1000,
    });
  }

  revokeUserSessions(userId: string): void {
    const now = Date.now();
    this.maybeCleanup(now);
    for (const [key, entry] of this.activeSessions.entries()) {
      if (entry.userId === userId) {
        this.activeSessions.delete(key);
        this.revokedSessions.set(key, {
          reason: 'deactivated',
          expiresAt: now + 24 * 60 * 60 * 1000,
        });
      }
    }
    // Also mark fallback userId key in case of legacy token without sid
    this.revokedSessions.set(userId, {
      reason: 'deactivated',
      expiresAt: now + 24 * 60 * 60 * 1000,
    });
  }

  shouldRecordIdleLog(username: string): boolean {
    const key = (username || 'unknown').toLowerCase();
    const now = Date.now();
    const prev = this.idleLogDedupe.get(key) || 0;
    if (now - prev < 15 * 1000) {
      return false;
    }
    this.idleLogDedupe.set(key, now);
    return true;
  }
}
