import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkSync - Task Tracking',
  description: 'ระบบติดตามงานสำหรับองค์กร',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="overflow-x-hidden">
      <body className="min-h-screen overflow-x-hidden" style={{ fontFamily: "'Prompt', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
