import type { Metadata, Viewport } from 'next';
import './globals.css';
import WorkSyncCopilotWidget from '@/components/WorkSyncCopilotWidget';

export const metadata: Metadata = {
  title: 'WorkSync — Enterprise Task & Collaboration',
  description: 'ระบบบริหารจัดการและติดตามงานภายในองค์กร Window Asia',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WorkSync',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0F19' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="overflow-x-hidden" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('worksync_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
                if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased bg-[#F2F2F7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors">
        {children}
        <WorkSyncCopilotWidget />
      </body>
    </html>
  );
}
