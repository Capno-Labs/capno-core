/**
 * Optional links out to a hosted account portal (sign-up, team invites,
 * password reset). This open-source core has no such pages of its own —
 * accounts are created by whoever operates the Supabase project — so every
 * affordance here is config-gated: unset means nothing is rendered.
 *
 *   NEXT_PUBLIC_ACCOUNT_PORTAL_URL   origin of the portal, e.g. https://start.example.org
 *   NEXT_PUBLIC_PASSWORD_RESET_URL   full URL of its "reset password" page
 *
 * Both must be https (http only for localhost); anything else is ignored so
 * a typo can't turn an in-app link into a `javascript:` or relative URL.
 */

function safeUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url;
  } catch {
    // fall through
  }
  return null;
}

/** The portal origin, or null when not configured. */
export function accountPortalOrigin(
  raw: string | undefined = process.env.NEXT_PUBLIC_ACCOUNT_PORTAL_URL,
): string | null {
  return safeUrl(raw)?.origin ?? null;
}

/** A page on the portal (`/start`, `/invites`), or null when not configured. */
export function accountPortalUrl(
  path: '/start' | '/invites',
  raw: string | undefined = process.env.NEXT_PUBLIC_ACCOUNT_PORTAL_URL,
): string | null {
  const origin = accountPortalOrigin(raw);
  return origin ? `${origin}${path}` : null;
}

/** The "reset password" page, or null when not configured. */
export function passwordResetUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_PASSWORD_RESET_URL,
): string | null {
  return safeUrl(raw)?.toString() ?? null;
}
