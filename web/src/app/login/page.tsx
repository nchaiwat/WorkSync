'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  login as authLogin,
  loginPin,
  getMe,
  getOrCreateDeviceToken,
  getSsoConfig,
  getSsoAuthorizeUrl,
} from '@/lib/auth';
import UserDisplay from '@/components/UserDisplay';
import ThemeToggle from '@/components/ThemeToggle';
import ForcedPasswordChangeModal from '@/components/ForcedPasswordChangeModal';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState<'local' | 'ad'>('local');

  const [isPinMode, setIsPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [lastUsername, setLastUsername] = useState('');
  const [deviceToken, setDeviceToken] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ─── หมวด F: In-App Bot Defense State (v2.10.0) ─────────────────────────
  const [corporateFax, setCorporateFax] = useState('');
  const [securityHoney, setSecurityHoney] = useState('');
  const [renderTs, setRenderTs] = useState(0);

  // ─── หมวด G: 90-Day Forced Password Rotation State (v2.12.0) ────────────
  const [showForcedChangeModal, setShowForcedChangeModal] = useState(false);
  const [isPasswordExpired, setIsPasswordExpired] = useState(false);
  const [tempToken, setTempToken] = useState('');

  // ─── SSO State ──────────────────────────────────────────────────────────
  const [ssoConfig, setSsoConfig] = useState<{
    sso_enabled: boolean;
    break_glass_active: boolean;
    ciam_base_url: string;
    login_button_label: string;
  } | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    setRenderTs(Date.now());

    if (typeof window !== 'undefined') {
      const savedType = localStorage.getItem('worksync_login_type') as 'local' | 'ad';
      if (savedType === 'ad' || savedType === 'local') {
        setLoginType(savedType);
      }
      const savedUser = localStorage.getItem('worksync_last_username');
      const token = getOrCreateDeviceToken();
      setDeviceToken(token);
      if (savedUser) {
        setLastUsername(savedUser);
        setUsername(savedUser);
        setIsPinMode(true);
      }
    }

    // Load SSO Config
    getSsoConfig()
      .then((cfg) => {
        setSsoConfig(cfg);
        if (cfg?.break_glass_active) {
          setLoginType('ad');
        }
      })
      .catch(() => {
        setSsoConfig({
          sso_enabled: false,
          break_glass_active: false,
          ciam_base_url: '',
          login_button_label: 'เข้าสู่ระบบด้วย Central IAM (SSO)',
        });
      });
  }, []);

  const handleCiamSso = async () => {
    setSsoLoading(true);
    setError('');
    try {
      const redirectUri = window.location.origin + '/auth/callback';
      const data = await getSsoAuthorizeUrl(redirectUri);
      sessionStorage.setItem('sso_code_verifier', data.code_verifier);
      sessionStorage.setItem('sso_state', data.state);
      window.location.href = data.authorize_url;
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถเชื่อมต่อไปยัง Central IAM ได้');
      setSsoLoading(false);
    }
  };

  const handlePinPress = (num: string) => {
    if (isLoading) return;
    setError('');
    if (num === 'back') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const newPin = pin + num;
    setPin(newPin);
    if (newPin.length === 6) submitPin(newPin);
  };

  const submitPin = async (completedPin: string) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await loginPin(lastUsername, completedPin, deviceToken);
      document.cookie = `directus_token=${result.access_token}; path=/; max-age=900000; SameSite=Lax`;
      document.cookie = `directus_refresh=${result.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `directus_username=${encodeURIComponent(lastUsername)}; path=/; max-age=604800; SameSite=Lax`;
      try {
        const user = await getMe(result.access_token);
        document.cookie = `directus_first_name=${encodeURIComponent(user.first_name || '')}; path=/; max-age=604800; SameSite=Lax`;
      } catch {
        /* ignore */
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบด้วย PIN ไม่สำเร็จ');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await authLogin(username, password, loginType, {
        corporate_fax: corporateFax || undefined,
        security_honey: securityHoney || undefined,
        form_render_ts: renderTs,
      });

      document.cookie = `directus_token=${result.access_token}; path=/; max-age=900000; SameSite=Lax`;
      document.cookie = `directus_refresh=${result.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `directus_username=${encodeURIComponent(username)}; path=/; max-age=604800; SameSite=Lax`;

      if (typeof window !== 'undefined') {
        localStorage.setItem('worksync_login_type', loginType);
        localStorage.setItem('app_auth_provider', 'local');
      }

      // Check Section 13 / 90-Day Forced Password Rotation
      if (result.must_change_password || result.password_expired) {
        setTempToken(result.access_token);
        setIsPasswordExpired(Boolean(result.password_expired));
        setShowForcedChangeModal(true);
        setIsLoading(false);
        return;
      }

      try {
        const user = await getMe(result.access_token);
        document.cookie = `directus_first_name=${encodeURIComponent(user.first_name || '')}; path=/; max-age=604800; SameSite=Lax`;
      } catch {
        /* ignore */
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  // State-driven conditions
  const isBreakGlass = ssoConfig?.break_glass_active === true || (ssoConfig as any)?.break_glass_active === 'true';
  const isSsoEnabled = (ssoConfig?.sso_enabled === true || (ssoConfig as any)?.sso_enabled === 'true') && !isBreakGlass;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#F2F2F7] dark:bg-[#0B0F19] px-4 transition-colors">
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* ─── หมวด G: Forced Password Change Modal (Section 13) ─────────────── */}
      {showForcedChangeModal && (
        <ForcedPasswordChangeModal
          username={username}
          isExpired={isPasswordExpired}
          token={tempToken}
          onSuccess={() => {
            setShowForcedChangeModal(false);
            router.push('/');
          }}
        />
      )}

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#151E2E] rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-7 sm:p-8 border border-slate-200/80 dark:border-slate-800">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-blue-500/20">
              🔄
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              WorkSync
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs sm:text-sm">
              {isPinMode ? 'เข้าใช้งานด้วย PIN Code' : 'ระบบติดตามงาน — บริษัท วินโดว์ เอเชีย จำกัด (มหาชน)'}
            </p>
          </div>

          {/* สถานการณ์ที่ 3: Break-Glass Alert Banner */}
          {isBreakGlass && (
            <div className="mb-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3.5 flex items-start gap-3 text-amber-800 dark:text-amber-300">
              <span className="text-lg">⚠️</span>
              <div className="text-xs leading-relaxed">
                <strong className="font-semibold block mb-0.5">ระบบอยู่ในโหมดฉุกเฉิน (Break-Glass Active)</strong>
                กรุณาเข้าใช้งานด้วยรหัสผ่าน Active Directory หรือ Local โดยตรง
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-red-600 dark:text-red-400 text-xs sm:text-sm text-center font-medium">
                {error}
              </p>
            </div>
          )}

          {isPinMode ? (
            /* PIN Mode Keypad */
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">ล็อกอินในฐานะ</p>
                <div className="inline-flex items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700/70 rounded-full shadow-inner">
                  <UserDisplay name={lastUsername} size="md" />
                </div>
              </div>

              <div className="flex justify-center gap-4 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm'
                        : 'border-gray-300 dark:border-slate-600 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto justify-items-center pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePinPress(num)}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setIsPinMode(false);
                    setError('');
                    setPin('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  ใช้รหัสผ่าน
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePinPress('0')}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePinPress('back')}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  ⌫
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* ─── หมวด 5.2 Desktop SSO: กะทัดรัด (Compact) อยู่ด้านบน ─────── */}
              {isSsoEnabled && (
                <div className="hidden md:block mb-5">
                  <button
                    type="button"
                    onClick={handleCiamSso}
                    disabled={ssoLoading || isLoading}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-75"
                  >
                    {ssoLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        กำลังเชื่อมต่อ Central IAM...
                      </span>
                    ) : (
                      <>
                        <span>🛡️ เข้าสู่ระบบด้วย Window Asia SSO ✨</span>
                      </>
                    )}
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-750" />
                    </div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="bg-white dark:bg-[#151E2E] px-3 text-slate-400 dark:text-slate-500">
                        หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Form Username & Password (เด่นชัดเสมอทั้ง Mobile & Desktop) ─── */}
              <form onSubmit={handleSubmit} className="relative space-y-4">
                {/* ─── หมวด F: Decoy Honeypot Trap (Invisible Anti-Bot Fields) ─── */}
                <div
                  className="absolute -left-[9999px] top-0 opacity-0 h-0 w-0 overflow-hidden pointer-events-none select-none"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <label htmlFor="corporate_fax">Corporate Fax</label>
                  <input
                    id="corporate_fax"
                    type="text"
                    name="corporate_fax"
                    value={corporateFax}
                    onChange={(e) => setCorporateFax(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                  <label htmlFor="security_honey">Security Code</label>
                  <input
                    id="security_honey"
                    type="text"
                    name="security_honey"
                    value={securityHoney}
                    onChange={(e) => setSecurityHoney(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {/* Type Switch Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('local');
                      setError('');
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      loginType === 'local'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    🏢 บัญชีทั่วไป (Local)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('ad');
                      setError('');
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      loginType === 'ad'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    🪟 Windows AD
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {loginType === 'ad' ? 'ชื่อผู้ใช้ (AD Username)' : 'ชื่อผู้ใช้ หรือ อีเมล'}
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={loginType === 'ad' ? 'เช่น somchai.p' : 'user@windowasia.com หรือ ชื่อผู้ใช้'}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all cursor-pointer ${
                    isBreakGlass
                      ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-400'
                      : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </span>
                  ) : isBreakGlass ? (
                    '🚨 เข้าสู่ระบบฉุกเฉิน (Break-Glass Sign In)'
                  ) : (
                    'เข้าสู่ระบบ (Sign In)'
                  )}
                </button>
              </form>

              {/* ─── หมวด 5.2 Mobile SSO: อยู่ด้านล่างฟอร์มหลักในขนาดกะทัดรัด ─── */}
              {isSsoEnabled && (
                <div className="block md:hidden pt-4 mt-1">
                  <div className="relative mb-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-750" />
                    </div>
                    <div className="relative flex justify-center text-[10px]">
                      <span className="bg-white dark:bg-[#151E2E] px-2.5 text-slate-400 dark:text-slate-500">
                        หรือเข้าสู่ระบบด้วย
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCiamSso}
                    disabled={ssoLoading || isLoading}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>🛡️ Window Asia SSO ✨</span>
                  </button>
                </div>
              )}

              {lastUsername && (
                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPinMode(true);
                      setError('');
                      setPin('');
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    เข้าสู่ระบบด้วย PIN Code →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-5 select-none">
          © 2026 Window Asia PCL. All rights reserved.
        </p>
      </div>
    </div>
  );
}
