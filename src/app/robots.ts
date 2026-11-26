import type { MetadataRoute } from 'next';

// Crawling is allowed everywhere on purpose. What may appear in search is
// decided by the X-Robots-Tag headers in next.config.mjs (tool views, and
// the whole site when ROBOTS_NOINDEX=1), and a crawler has to be able to
// fetch a page to see that header — a Disallow here would hide it.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const listed = base && process.env.ROBOTS_NOINDEX !== '1';
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    ...(listed ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
