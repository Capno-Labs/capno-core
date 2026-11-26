import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthUrlGuard } from '@/components/AuthUrlGuard';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { THEME_COLORS, THEME_STORAGE_KEY } from '@/lib/theme';
import { DialogHost } from '@/components/ui/Dialog';
import { Toaster } from '@/components/ui/Toaster';

// Display face: Inter Tight 900 (OFL), self-hosted and subset to capitals,
// digits and basic punctuation (~4 KB) — the same file as the capno.app
// landing page. No font CDN: the app stays offline-first, and the fallback
// stack covers a cold offline load. Used only through the `.display` class.
const display = localFont({
  src: '../fonts/InterTight-900-display.woff2',
  weight: '900',
  display: 'swap',
  variable: '--font-display-face',
  adjustFontFallback: 'Arial',
});

// Public origin of this deployment (optional — self-hosts work without it).
// When set, social-share metadata resolves to absolute URLs.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

// The page a search engine shows for this deployment is the app itself, so
// the title and description say what opening it gets you. (The product
// pitch lives on the marketing site; two results with the same title are
// indistinguishable.)
const TITLE = 'CAPNO Studio — simulator workspace';
const DESCRIPTION =
  'The CAPNO Studio app: open the case library, drive the simulated patient monitor from the faculty controller, join a session as a student display, or review a debrief. Simulation only — not for clinical use.';

export const metadata: Metadata = {
  // With a known origin, every page names itself as canonical ('./'
  // resolves against the current path), so a shared ?code= link or a
  // tracking parameter never becomes a second copy of the page.
  ...(siteUrl ? { metadataBase: new URL(siteUrl), alternates: { canonical: './' } } : {}),
  title: {
    default: TITLE,
    template: '%s · CAPNO Studio',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'CAPNO Studio',
    title: TITLE,
    description: DESCRIPTION,
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
  // From the brand asset pack (docs/brand.md). The SVG favicon adapts to the
  // browser's light or dark theme; the .ico covers browsers without SVG
  // favicon support.
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.dark,
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
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthUrlGuard />
        <ServiceWorkerRegistrar />
        <Toaster />
        <DialogHost />
        {children}
      </body>
    </html>
  );
}
