import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { Toaster } from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: {
    default: 'CAPNO Studio — Anesthesia Simulation Lab',
    template: '%s · CAPNO Studio',
  },
  description:
    'Open anesthesia simulation platform: faculty-controlled patient monitor, scenario engine, and structured debriefing.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CAPNO Studio',
  },
  icons: {
    icon: [
      { url: '/brand/capno-icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#05080d',
  width: 'device-width',
  initialScale: 1,
  // Prevent accidental pinch-zoom on the touch controller in the lab.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
