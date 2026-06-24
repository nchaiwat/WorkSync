'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login as authLogin, loginPin, getMe, getOrCreateDeviceToken } from '@/lib/auth';
import UserDisplay from '@/components/UserDisplay';

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

  useEffect(() => {
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
  }, []);

  const handlePinPress = (num: string) => {
    if (isLoading) return;
    setError('');
    if (num === 'back') { setPin((prev) => prev.slice(0, -1)); return; }
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
      document.cookie = `directus_token=${result.access_token}; path=/; max-age=900000`;
      document.cookie = `directus_refresh=${result.refresh_token}; path=/; max-age=604800`;
      document.cookie = `directus_username=${encodeURIComponent(lastUsername)}; path=/; max-age=604800`;
      try {
        const user = await getMe(result.access_token);
        document.cookie = `directus_first_name=${encodeURIComponent(user.first_name || '')}; path=/; max-age=604800`;
      } catch { /* ignore */ }
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
      const result = await authLogin(username, password, loginType);
      document.cookie = `directus_token=${result.access_token}; path=/; max-age=900000`;
      document.cookie = `directus_refresh=${result.refresh_token}; path=/; max-age=604800`;
      document.cookie = `directus_username=${encodeURIComponent(username)}; path=/; max-age=604800`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('worksync_login_type', loginType);
      }
      try {
        const user = await getMe(result.access_token);
        document.cookie = `directus_first_name=${encodeURIComponent(user.first_name || '')}; path=/; max-age=604800`;
      } catch { /* ignore */ }
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700/60">
          {/* Logo */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🔄 WorkSync</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              {isPinMode ? 'เข้าใช้งานด้วย PIN Code' : 'เข้าสู่ระบบเพื่อจัดการงาน'}
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {isPinMode ? (
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
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => { setIsPinMode(false); setError(''); setPin(''); }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  ใช้รหัสผ่าน
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePinPress('0')}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handlePinPress('back')}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all"
                >
                  ⌫
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type Switch Tabs */}
              <div className="flex p-1 bg-gray-100 dark:bg-slate-700/50 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('local');
                    localStorage.setItem('worksync_login_type', 'local');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    loginType === 'local'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  👤 บัญชี WorkSync
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('ad');
                    localStorage.setItem('worksync_login_type', 'ad');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    loginType === 'ad'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  🏢 บัญชี Windows AD
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="ชื่อผู้ใช้ในระบบ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {loginType === 'ad'
                    ? 'กรุณากรอกรหัสผ่าน Windows Active Directory สำหรับเข้าสู่ระบบ'
                    : 'รองรับการล็อกอินผ่านรหัสผ่านบัญชีระบบโดยตรง'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : '🔐 เข้าสู่ระบบ'}
              </button>

              {lastUsername && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsPinMode(true); setError(''); setPin(''); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    เข้าสู่ระบบด้วย PIN Code →
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-5 select-none">
          © 2026 Window Asia PCL. All rights reserved.
        </p>
      </div>
    </div>
  );
}
