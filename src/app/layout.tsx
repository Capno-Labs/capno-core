import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { THEME_COLORS, THEME_STORAGE_KEY } from '@/lib/theme';
import { Toaster } from '@/components/ui/Toaster';

// Public origin of this deployment (optional — self-hosts work without it).
// When set, social-share metadata resolves to absolute URLs.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: 'CAPNO Studio — Anesthesia Simulation Lab',
    template: '%s · CAPNO Studio',
  },
  description:
    'Open anesthesia simulation platform: faculty-controlled patient monitor, scenario engine, and structured debriefing.',
  openGraph: {
    type: 'website',
    siteName: 'CAPNO Studio',
    title: 'CAPNO Studio — Anesthesia Simulation Lab',
    description:
      'Open anesthesia simulation platform: faculty-controlled patient monitor, scenario engine, and structured debriefing.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
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
  themeColor: '#0d0f0c',
  width: 'device-width',
  initialScale: 1,
  // Prevent accidental pinch-zoom on the touch controller in the lab.
  maximumScale: 1,
};

// Applies a stored light-theme preference before hydration so there is no
// flash of the wrong theme. Dark is the no-attribute default, so users with
// nothing stored take the zero-cost path. Key and color interpolate from
// src/lib/theme.ts so they cannot drift; the meta update retries on
// DOMContentLoaded in case the theme-color tag streams in after this script.
const themeInitScript = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='light'){document.documentElement.dataset.theme='light';var u=function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${THEME_COLORS.light}')};u();document.addEventListener('DOMContentLoaded',u)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
