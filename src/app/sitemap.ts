import type { MetadataRoute } from 'next';

// The home page only: every other route is a tool view served with
// `noindex` (see next.config.mjs), and a deployment that sets
// ROBOTS_NOINDEX=1 lists nothing. Without NEXT_PUBLIC_SITE_URL the URL
// falls back to localhost, which is harmless: deployments that aren't
// reachable by crawlers have no use for a sitemap anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.ROBOTS_NOINDEX === '1') return [];
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return [{ url: base }];
}
