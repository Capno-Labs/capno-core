// Search indexing. The home page is the one page worth finding in a search
// engine; every other route is a tool view rendered in the browser (a live
// session, the editor, an archive stored on this device), so it is served
// with `X-Robots-Tag: noindex`. The header only works if crawlers may fetch
// the page, which is why robots.txt does not disallow these routes.
//
// ROBOTS_NOINDEX=1 keeps the whole deployment out of search — staging,
// demo and private lab instances that are reachable from the internet.
const noindexAll = process.env.ROBOTS_NOINDEX === '1';

const TOOL_ROUTES = [
  '/student',
  '/scenarios/:path*',
  '/editor',
  '/debrief/:path*',
  '/faculty/:path*',
  '/account',
  '/settings',
];

const indexingHeaders = noindexAll
  ? [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  : TOOL_ROUTES.map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
    }));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The service worker (public/sw.js) handles offline caching; no plugin needed.
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    ...indexingHeaders,
  ],
};

export default nextConfig;
