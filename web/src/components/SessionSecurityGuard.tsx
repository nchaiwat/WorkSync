'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  getAuthToken,
  getMe,
  getSsoConfig,
  pingSession,
  logout,
  logoutIdleTimeout,
} from '@/lib/auth';
import ForcedPasswordChangeModal from '@/components/ForcedPasswordChangeModal';

const LAST_ACTIVITY_STORAGE_KEY = 'worksync_last_activity_ts';
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/start'];

export default function SessionSecurityGuard() {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  // Idle Timeout Settings
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number>(30);
  const [warningSeconds, setWarningSeconds] = useState<number>(60);
  const [isActiveSession, setIsActiveSession] = useState<boolean>(false);

  // Warning Modal State
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isExtending, setIsExtending] = useState<boolean>(false);

  // Global Forced Password Change State (Section 13 / หมวด G)
  const [forcedPwUser, setForcedPwUser] = useState<{
    username: string;
    isExpired: boolean;
    token: string;
  } | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const isWarningRef = useRef<boolean>(false);
  const timedOutRef = useRef<boolean>(false);
  const checkedTokenRef = useRef<string>('');

  useEffect(() => {
    isWarningRef.current = isWarning;
  }, [isWarning]);

  // 1. Initialize session security config and check password rotation status
  useEffect(() => {
    if (isPublicRoute) {
      setIsActiveSession(false);
      setIsWarning(false);
      setForcedPwUser(null);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setIsActiveSession(false);
      return;
    }

    setIsActiveSession(true);
    timedOutRef.current = false;

    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      /* ignore */
    }

    // Load Idle Timeout configuration from backend
    getSsoConfig()
      .then((cfg) => {
        const mins = Number(cfg?.idle_timeout_minutes);
        const warn = Number(cfg?.idle_warning_seconds);
        if (!isNaN(mins) && mins >= 1) {
          setIdleTimeoutMinutes(mins);
        }
        if (!isNaN(warn) && warn >= 10) {
          setWarningSeconds(warn);
        }
      })
      .catch(() => {
        /* fallback to defaults 30m / 60s */
      });

    // Global 90-Day Password Rotation check (only once per token)
    if (checkedTokenRef.current !== token) {
      checkedTokenRef.current = token;
      getMe(token)
        .then((user) => {
          if (
            user &&
            !user.is_ad_auth &&
            (user.must_change_password || user.password_expired)
          ) {
            setForcedPwUser({
              username: user.username,
              isExpired: Boolean(user.password_expired),
              token,
            });
          } else {
            setForcedPwUser(null);
          }
        })
        .catch(() => {
          /* handled by getMe 401 redirect if invalid */
        });
    }
  }, [pathname, isPublicRoute]);

  // 2. Throttled user activity listener + cross-tab sync
  useEffect(() => {
    if (!isActiveSession || isPublicRoute) return;

    let lastRecorded = 0;
    const recordActivity = () => {
      if (isWarningRef.current || timedOutRef.current) return;
      const now = Date.now();
      if (now - lastRecorded > 1500) {
        lastRecorded = now;
        lastActivityRef.current = now;
        try {
          localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (!isNaN(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          if (isWarningRef.current) {
            setIsWarning(false);
          }
        }
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, recordActivity, { passive: true }),
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      events.forEach((evt) =>
        window.removeEventListener(evt, recordActivity),
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, [isActiveSession, isPublicRoute]);

  // 3. Periodic 1-second timer check
  useEffect(() => {
    if (!isActiveSession || isPublicRoute) return;

    const idleTimeoutMs = Math.max(1, idleTimeoutMinutes) * 60 * 1000;
    const effectiveWarningSec = Math.min(
      warningSeconds,
      Math.max(10, Math.floor((idleTimeoutMinutes * 60) / 2)),
    );
    const warningThresholdMs = idleTimeoutMs - effectiveWarningSec * 1000;

    const timer = setInterval(() => {
      if (timedOutRef.current) return;

      // Sync latest timestamp across open tabs
      try {
        const stored = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        if (!isNaN(stored) && stored > lastActivityRef.current) {
          lastActivityRef.current = stored;
        }
      } catch {
        /* ignore */
      }

      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= idleTimeoutMs) {
        timedOutRef.current = true;
        clearInterval(timer);
        setIsWarning(false);
        logoutIdleTimeout(pathname || '/');
      } else if (elapsed >= warningThresholdMs) {
        const rem = Math.max(0, Math.ceil((idleTimeoutMs - elapsed) / 1000));
        setIsWarning(true);
        setSecondsRemaining(rem);
      } else if (isWarningRef.current) {
        setIsWarning(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isActiveSession, isPublicRoute, idleTimeoutMinutes, warningSeconds, pathname]);

  // 4. Extend session handler
  const handleExtendSession = useCallback(async () => {
    const token = getAuthToken();
    setIsExtending(true);
    try {
      if (token) {
        await pingSession(token);
      }
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        /* ignore */
      }
      setIsWarning(false);
    } catch {
      logoutIdleTimeout(pathname || '/');
    } finally {
      setIsExtending(false);
    }
  }, [pathname]);

  if (isPublicRoute || !isActiveSession) return null;

  return (
    <>
      {/* Global Forced Password Change Guard (Section 13 / หมวด G) */}
      {forcedPwUser && (
        <ForcedPasswordChangeModal
          username={forcedPwUser.username}
          isExpired={forcedPwUser.isExpired}
          token={forcedPwUser.token}
          onSuccess={() => setForcedPwUser(null)}
        />
      )}

      {/* Idle Timeout Warning Countdown Modal (Section 14.3 / หมวด H) */}
      {isWarning && (
        <div
          className="fixed inset-0 bg-slate-900/75 dark:bg-slate-950/85 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idle-timeout-title"
        >
          <div className="bg-white dark:bg-[#151E2E] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-amber-200 dark:border-amber-800/60 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shrink-0">
                ⏱️
              </div>
              <div>
                <h3
                  id="idle-timeout-title"
                  className="text-base font-bold text-slate-900 dark:text-white leading-tight"
                >
                  แจ้งเตือนความปลอดภัยเซสชัน
                </h3>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  ISO 27001 Idle Session Timeout ({idleTimeoutMinutes} นาที)
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              ⚠️ คุณไม่มีการใช้งานระบบมาระยะหนึ่ง ระบบจะออกจากระบบอัตโนมัติเพื่อความปลอดภัยในอีก{' '}
              <span className="inline-block min-w-[2.2rem] text-center font-mono font-bold text-base text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40">
                {secondsRemaining}
              </span>{' '}
              วินาที
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExtendSession}
                disabled={isExtending}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer"
              >
                {isExtending ? 'กำลังต่ออายุเซสชัน...' : 'ขยายเวลาใช้งาน'}
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                ออกจากระบบทันที
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
