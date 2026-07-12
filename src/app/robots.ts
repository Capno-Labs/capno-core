import type { MetadataRoute } from 'next';

// Live session runners and utility views aren't useful search results;
// the stable entry points (home, library, monitor, debrief, editor) are.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/faculty/', '/account', '/settings'],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
