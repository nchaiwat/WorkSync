'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ssoCallback } from '@/lib/auth';
import Link from 'next/link';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleExchange = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (errorParam) {
        setStatus('error');
        setErrorMessage(errorDesc || errorParam || 'การยืนยันตัวตนถูกยกเลิกหรือล้มเหลว');
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('ไม่พบรหัสยืนยันตัวตน (Authorization Code) จาก Central IAM');
        return;
      }

      const savedState = sessionStorage.getItem('sso_state');
      if (savedState && state && savedState !== state) {
        setStatus('error');
        setErrorMessage('ความปลอดภัยไม่ถูกต้อง: State mismatch (อาจเกิดจากการโจมตีแบบ CSRF)');
        return;
      }

      const codeVerifier = sessionStorage.getItem('sso_code_verifier') || '';
      const redirectUri = window.location.origin + '/auth/callback';

      try {
        const result = await ssoCallback(code, codeVerifier, redirectUri);

        // Save Auth Cookies
        document.cookie = `directus_token=${result.access_token}; path=/; max-age=900000; SameSite=Lax`;
        document.cookie = `directus_refresh=${result.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
        if (result.user?.username) {
          document.cookie = `directus_username=${encodeURIComponent(result.user.username)}; path=/; max-age=604800; SameSite=Lax`;
          localStorage.setItem('worksync_last_username', result.user.username);
        }
        if (result.user?.first_name) {
          document.cookie = `directus_first_name=${encodeURIComponent(result.user.first_name)}; path=/; max-age=604800; SameSite=Lax`;
        }

        // Clean up storage
        sessionStorage.removeItem('sso_code_verifier');
        sessionStorage.removeItem('sso_state');

        setStatus('success');
        router.push('/');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการแลกเปลี่ยน Token กับระบบกลาง');
      }
    };

    handleExchange();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700/60 text-center">
        {status === 'loading' && (
          <div className="py-6">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-900/40 animate-ping"></div>
              <div className="relative w-16 h-16 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-blue-600 border-l-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              กำลังยืนยันตัวตน...
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              กำลังเชื่อมต่อกับ Window Asia Central IAM และออก Session ประจำระบบ
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-3xl animate-bounce">
              ✓
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              เข้าสู่ระบบสำเร็จ!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              กำลังนำท่านเข้าสู่ระบบ WorkSync...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-3xl">
              ✕
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              ยืนยันตัวตนไม่สำเร็จ
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-900/40">
              {errorMessage}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              กลับไปยังหน้าเข้าสู่ระบบ
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500">
          กำลังโหลด...
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
