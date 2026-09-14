'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, getAuthToken, logout as authLogout, admin } from '@/lib/auth';

interface CiamSettings {
  ciam_base_url: string;
  ciam_client_id: string;
  ciam_client_secret_masked: string;
  ciam_sso_enabled: boolean;
  ciam_break_glass_active: boolean;
  ciam_ad_gateway_url: string;
  ciam_auto_provision_group: string;
  ciam_session_ttl_minutes: number;
  updated_at?: string;
}

interface TestConnectionResult {
  status: 'connected' | 'error';
  latency_ms?: number;
  ciam_issuer?: string;
  jwks_uri?: string;
  keys_found?: number;
  key_id?: string;
  message: string;
}

interface TransactionLog {
  id: number;
  category: string;
  action: string;
  status: string;
  message: string;
  details?: string;
  records_count?: number;
  duration_ms?: number;
  triggered_by: string;
  created_at: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [settings, setSettings] = useState<CiamSettings>({
    ciam_base_url: 'https://ciam.windowasia.com',
    ciam_client_id: 'worksync-spoke-client',
    ciam_client_secret_masked: '',
    ciam_sso_enabled: true,
    ciam_break_glass_active: false,
    ciam_ad_gateway_url: 'http://192.168.12.11:3100',
    ciam_auto_provision_group: 'User',
    ciam_session_ttl_minutes: 480,
  });

  const [newSecret, setNewSecret] = useState('');
  const [showSecretInput, setShowSecretInput] = useState(false);

  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [logCategory, setLogCategory] = useState<string>('');

  // Break-Glass Modal
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [isTogglingBg, setIsTogglingBg] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const me = await getMe(token);
      const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
      const roleId = typeof me.role === 'object' ? me.role?.id : me.role;
      if (roleId !== ADMIN_ROLE_ID && me.role?.name !== 'Administrator') {
        router.push('/');
        return;
      }
      setIsAdmin(true);
      await loadSettingsAndLogs(token);
    } catch {
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettingsAndLogs = async (token: string) => {
    try {
      const res = await admin.getCiamSettings(token);
      if (res?.settings) {
        setSettings(res.settings);
      }
      const logsRes = await admin.getCiamLogs(token, logCategory, 30);
      if (logsRes?.data) {
        setLogs(logsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถโหลดการตั้งค่าได้');
    }
  };

  const handleTestConnection = async () => {
    const token = getAuthToken();
    if (!token) return;
    setIsTesting(true);
    setError('');
    try {
      const result = await admin.testCiamConnection(token);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'การทดสอบการเชื่อมต่อล้มเหลว',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {
        ciam_base_url: settings.ciam_base_url,
        ciam_client_id: settings.ciam_client_id,
        ciam_sso_enabled: settings.ciam_sso_enabled,
        ciam_ad_gateway_url: settings.ciam_ad_gateway_url,
        ciam_auto_provision_group: settings.ciam_auto_provision_group,
        ciam_session_ttl_minutes: Number(settings.ciam_session_ttl_minutes),
      };

      if (newSecret.trim()) {
        payload.ciam_client_secret = newSecret.trim();
      }

      const res = await admin.updateCiamSettings(token, payload);
      setSuccess(res.message || 'บันทึกการตั้งค่าเรียบร้อยแล้ว');
      setNewSecret('');
      setShowSecretInput(false);

      // Reload fresh settings
      const updated = await admin.getCiamSettings(token);
      if (updated?.settings) {
        setSettings(updated.settings);
      }
      const logsRes = await admin.getCiamLogs(token, logCategory, 30);
      if (logsRes?.data) setLogs(logsRes.data);
    } catch (err: any) {
      setError(err.message || 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBreakGlass = async () => {
    const token = getAuthToken();
    if (!token) return;

    setIsTogglingBg(true);
    setError('');
    setSuccess('');

    const targetState = !settings.ciam_break_glass_active;

    try {
      const res = await admin.toggleBreakGlass(token, targetState, breakGlassReason);
      setSuccess(res.message);
      setShowBreakGlassModal(false);
      setBreakGlassReason('');

      // Reload settings
      const updated = await admin.getCiamSettings(token);
      if (updated?.settings) {
        setSettings(updated.settings);
      }
      const logsRes = await admin.getCiamLogs(token, logCategory, 30);
      if (logsRes?.data) setLogs(logsRes.data);
    } catch (err: any) {
      setError(err.message || 'เปลี่ยนสถานะ Break-Glass ไม่สำเร็จ');
    } finally {
      setIsTogglingBg(false);
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500">
        กำลังโหลดข้อมูลการตั้งค่า...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                &larr; กลับหน้าหลัก
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ⚙️ ตั้งค่าระบบ (System Settings)
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={authLogout}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 mt-4 border-t border-gray-100 dark:border-slate-700 pt-3 overflow-x-auto scrollbar-none">
            <Link
              href="/admin/users"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              👥 ผู้ใช้งานในระบบ
            </Link>
            <Link
              href="/admin/login-logs"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              📋 ประวัติการเข้าใช้งาน
            </Link>
            <Link
              href="/admin/announce"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              📢 ประกาศระบบ
            </Link>
            <Link
              href="/admin/settings"
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 pb-2"
            >
              ⚙️ ตั้งค่าระบบ (Central IAM SSO)
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-r-lg p-4 shadow-sm">
            <p className="text-green-700 dark:text-green-400 text-sm font-medium">{success}</p>
          </div>
        )}

        {/* 1. Health & Connection Test Banner */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl">📡</span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  สถานะการเชื่อมต่อ Central IAM Engine
                </h2>
                {testResult ? (
                  testResult.status === 'connected' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      🟢 เชื่อมต่อปกติ (Online)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      🔴 ไม่สามารถเชื่อมต่อได้ (Offline)
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300">
                    ⚪ ยังไม่ได้ทดสอบ
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ทดสอบการเชื่อมต่อไปยัง OIDC Discovery และ JWKS Endpoint จากเซิร์ฟเวอร์
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  กำลังทดสอบ...
                </>
              ) : (
                <>
                  <span>⚡</span> ทดสอบการเชื่อมต่อไปยัง Central IAM
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`mt-4 p-4 rounded-xl text-xs space-y-1.5 border ${
              testResult.status === 'connected'
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}>
              <div className="font-semibold">{testResult.message}</div>
              {testResult.latency_ms !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div>⏱️ Latency: <strong>{testResult.latency_ms} ms</strong></div>
                  <div>🔑 JWKS Key ID: <strong>{testResult.key_id || '-'}</strong></div>
                  <div>🏢 Issuer: <strong>{testResult.ciam_issuer || '-'}</strong></div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. Break-Glass Emergency Card */}
        <section className={`rounded-2xl border p-6 transition-all ${
          settings.ciam_break_glass_active
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/70'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  โหมดปลดระบบฉุกเฉิน (Break-Glass Emergency Panel)
                </h2>
                {settings.ciam_break_glass_active ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 animate-pulse">
                    ACTIVE (กำลังใช้งาน)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                    STANDBY (ปกติ)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                เมื่อเปิดโหมดนี้ หน้าจอล็อกอินจะอนุญาตให้พนักงานเข้าใช้งานด้วยรหัสผ่าน Windows Active Directory หรือ Local Admin โดยส่งตรงไปยัง AD Gateway สำรอง เพื่อความต่อเนื่องทางธุรกิจ
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowBreakGlassModal(true)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                settings.ciam_break_glass_active
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <span>{settings.ciam_break_glass_active ? '✅ ปิดโหมดฉุกเฉิน (คืนค่าปกติ)' : '⚠️ เปิดโหมดฉุกเฉิน (Break-Glass)'}</span>
            </button>
          </div>
        </section>

        {/* 3. Settings Form (Zero .env) */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🛡️</span> การตั้งค่า Central IAM SSO (Zero .env Standard)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                การตั้งค่าทั้งหมดถูกจัดเก็บในตาราง <code>system_settings</code> และมีผลทันทีโดยไม่ต้อง Restart Container
              </p>
            </div>
            {settings.updated_at && (
              <span className="text-[11px] text-gray-400">
                อัปเดตล่าสุด: {new Date(settings.updated_at).toLocaleString('th-TH')}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Central IAM Base URL
                </label>
                <input
                  type="url"
                  required
                  value={settings.ciam_base_url}
                  onChange={(e) => setSettings({ ...settings, ciam_base_url: e.target.value })}
                  placeholder="https://ciam.windowasia.com"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">URL หลักของ Central IAM Engine (ห้ามมี / ต่อท้าย)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  OIDC Client ID
                </label>
                <input
                  type="text"
                  required
                  value={settings.ciam_client_id}
                  onChange={(e) => setSettings({ ...settings, ciam_client_id: e.target.value })}
                  placeholder="worksync-spoke-client"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">Client ID ที่ลงทะเบียนไว้ใน Central IAM Portal</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  OIDC Client Secret
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={settings.ciam_client_secret_masked || 'ยังไม่ได้กำหนด'}
                    className="flex-1 px-3.5 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-100 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretInput(!showSecretInput)}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-gray-700 dark:text-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {showSecretInput ? 'ยกเลิก' : '🔑 เปลี่ยน Secret'}
                  </button>
                </div>
                {showSecretInput && (
                  <div className="mt-2">
                    <input
                      type="password"
                      value={newSecret}
                      onChange={(e) => setNewSecret(e.target.value)}
                      placeholder="ใส่ Secret ใหม่ที่คัดลอกมาจาก Central IAM"
                      className="w-full px-3.5 py-2 text-sm border border-blue-400 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                      ระบุเฉพาะเมื่อต้องการเปลี่ยนรหัสลับใหม่
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Active Directory Gateway URL (Fallback)
                </label>
                <input
                  type="text"
                  required
                  value={settings.ciam_ad_gateway_url}
                  onChange={(e) => setSettings({ ...settings, ciam_ad_gateway_url: e.target.value })}
                  placeholder="http://192.168.12.11:3100"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">สำหรับเชื่อมต่อไปยัง AD Gateway เมื่อเกิดเหตุฉุกเฉิน</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  กลุ่มสิทธิ์เริ่มต้นสำหรับพนักงานใหม่ (Auto-Provision Group)
                </label>
                <select
                  value={settings.ciam_auto_provision_group}
                  onChange={(e) => setSettings({ ...settings, ciam_auto_provision_group: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="User">User (ผู้ใช้งานทั่วไป)</option>
                  <option value="Admin">Administrator (ผู้ดูแลระบบ)</option>
                </select>
                <span className="text-[11px] text-gray-400 mt-1 block">สิทธิ์เริ่มต้นสำหรับบัญชีที่ล็อกอินผ่าน SSO เป็นครั้งแรก</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  อายุ Session Token (นาที)
                </label>
                <input
                  type="number"
                  min="30"
                  max="1440"
                  value={settings.ciam_session_ttl_minutes}
                  onChange={(e) => setSettings({ ...settings, ciam_session_ttl_minutes: parseInt(e.target.value, 10) || 480 })}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">ค่ามาตรฐานแนะนำ: 480 นาที (8 ชั่วโมง)</span>
              </div>
            </div>

            {/* Enforce SSO Switch */}
            <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                  เปิดใช้งาน Central IAM SSO (Enforce SSO Toggle)
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  หากปิดสวิตช์นี้ หน้าจอล็อกอินจะเข้าสู่โหมด Clean Standard Login ตามข้อกำหนด Zero-Confusion
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ciam_sso_enabled}
                  onChange={(e) => setSettings({ ...settings, ciam_sso_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer"
              >
                {isSaving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
              </button>
            </div>
          </form>
        </section>

        {/* 4. Security Audit Logs Table (ISO 27001) */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>📋</span> Security Audit Trail (ISO 27001 Logs)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ประวัติการทำรายการที่เกี่ยวข้องกับ Central IAM SSO, Break-Glass และการเปลี่ยนแปลงคอนฟิก
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logCategory}
                onChange={(e) => {
                  setLogCategory(e.target.value);
                  const token = getAuthToken();
                  if (token) admin.getCiamLogs(token, e.target.value, 30).then((res) => setLogs(res?.data || []));
                }}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 focus:outline-none"
              >
                <option value="">ทั้งหมด (All Categories)</option>
                <option value="ciam_sso">ciam_sso (SSO Events)</option>
                <option value="security_break_glass">security_break_glass (Break-Glass)</option>
                <option value="system_setting">system_setting (Config Changes)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">เวลา (Timestamp)</th>
                  <th className="py-2.5 px-3">หมวดหมู่ (Category)</th>
                  <th className="py-2.5 px-3">การกระทำ (Action)</th>
                  <th className="py-2.5 px-3">สถานะ</th>
                  <th className="py-2.5 px-3">ข้อความ (Message)</th>
                  <th className="py-2.5 px-3">ดำเนินการโดย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      ยังไม่มีบันทึก Transaction Logs ในระบบ
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-mono text-[10px]">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200 font-mono text-[11px]">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : log.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            : log.status === 'warning'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-xs truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                        {log.triggered_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Break-Glass Confirmation Modal */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                ยืนยันการสลับโหมด Break-Glass
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              คุณกำลังจะ {settings.ciam_break_glass_active ? 'ปิดโหมดฉุกเฉิน และคืนสู่ระบบ SSO ปกติ' : 'เปิดโหมดฉุกเฉิน เพื่ออนุญาตให้เข้าใช้งานด้วยรหัสผ่านตรงผ่าน AD Gateway'}
              <br />
              <strong className="text-red-600 dark:text-red-400">เหตุการณ์นี้จะถูกบันทึกเป็น Security Audit Trail</strong>
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                เหตุผลในการดำเนินการ (Required Reason):
              </label>
              <textarea
                required
                rows={3}
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
                placeholder="เช่น เซิร์ฟเวอร์ Central IAM อยู่ระหว่างบำรุงรักษาฉุกเฉิน..."
                className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowBreakGlassModal(false); setBreakGlassReason(''); }}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isTogglingBg || !breakGlassReason.trim()}
                onClick={handleToggleBreakGlass}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {isTogglingBg ? 'กำลังดำเนินการ...' : 'ยืนยันการสลับโหมด'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
