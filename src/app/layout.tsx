import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'رێکخراوی اقرا - لقی هەولێر - سیستەمی بەڕێوەبردنی ئابوونە',
  description: 'سیستەمی بەڕێوەبردنی بەشداریکردنی قوتابیان بۆ رێکخراوی اقرا - لقی هەولێر',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a5f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ku" dir="rtl">
      <body className="font-sans antialiased bg-gray-50 min-h-screen">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
