'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSsoAuthorizeUrl } from '@/lib/auth';

export default function SsoStartPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initiateSso = async () => {
      try {
        const redirectUri = window.location.origin + '/auth/callback';
        const data = await getSsoAuthorizeUrl(redirectUri);

        // Bind PKCE Verifier & State to browser session (RFC 9700 / RFC 7636)
        sessionStorage.setItem('sso_code_verifier', data.code_verifier);
        sessionStorage.setItem('sso_state', data.state);

        // Seamless 302 Bounce to Central IAM Authorize URL
        window.location.href = data.authorize_url;
      } catch (err: any) {
        console.error('RFC 9700 SSO Start Initiation Error:', err);
        setError(err.message || 'ไม่สามารถเริ่มต้นการเข้าสู่ระบบผ่าน Central IAM ได้');
      }
    };

    initiateSso();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-6 rounded-2xl border border-rose-500/30 text-center space-y-4 shadow-xl">
          <div className="text-rose-500 font-bold text-lg">เริ่มต้น SSO ไม่สำเร็จ</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-md"
          >
            กลับสู่หน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="relative w-14 h-14 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-900/40 animate-ping" />
          <div className="relative w-14 h-14 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-blue-600 border-l-transparent animate-spin" />
        </div>
        <h2 className="text-lg font-bold">กำลังเริ่มต้น Single Sign-On...</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ผูกเซสชันความปลอดภัย RFC 9700 และเชื่อมต่อกับ Window Asia Central IAM
        </p>
      </div>
    </div>
  );
}
