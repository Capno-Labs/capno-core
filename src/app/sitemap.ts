import type { MetadataRoute } from 'next';

// Stable public entry points only — per-session /faculty/run/* URLs and
// utility views are excluded (see robots.ts). Without NEXT_PUBLIC_SITE_URL
// the URLs fall back to localhost, which is harmless: deployments that
// aren't reachable by crawlers have no use for a sitemap anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return ['', '/scenarios', '/student', '/editor', '/debrief'].map((path) => ({
    url: `${base}${path}`,
  }));
}
