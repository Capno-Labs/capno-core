/**
 * Sign-in links that land on /account.
 *
 * A deployment that operates its own account portal on another origin can
 * hand a freshly signed-in user over to this app without a second password
 * prompt: its server mints a single-use Supabase token for that user and
 * redirects to
 *
 *   /account#token_hash=<hash>&type=magiclink&email=<address>
 *
 * The values travel in the URL FRAGMENT on purpose — a fragment is never
 * sent to a server, so the token stays out of access logs and Referer
 * headers — and the page strips it from the address bar before using it.
 * `email` alone (no token) just prefills the sign-in form. A token is only
 * honoured together with the email it claims to be for: the exchange is
 * rejected unless the resulting session belongs to that address.
 *
 * The key names deliberately avoid `access_token`, `code` and `error*`,
 * the names Supabase's own redirect links use. This app never signs in from
 * those (the client is created with `detectSessionInUrl: false`); a fragment
 * that carries them is only cleaned out of the address bar — see
 * `hasSessionFragment`.
 *
 * Pure and framework-free so it is testable in Node.
 */

export type AuthLinkType = 'magiclink' | 'email';

export interface AuthLink {
  /** Single-use token hash to exchange via `auth.verifyOtp`. */
  tokenHash?: string;
  type?: AuthLinkType;
  /** Address to prefill (and to show if the exchange fails). */
  email?: string;
}

const TOKEN_HASH = /^[A-Za-z0-9_-]{16,128}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
const TYPES: readonly AuthLinkType[] = ['magiclink', 'email'];

export function parseAuthFragment(hash: string): AuthLink {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const link: AuthLink = {};

  const email = params.get('email');
  if (email && EMAIL.test(email)) link.email = email;

  // A token is only usable with a recognised type; anything malformed is
  // dropped whole rather than half-trusted.
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as AuthLinkType | null;
  if (tokenHash && TOKEN_HASH.test(tokenHash) && type && TYPES.includes(type)) {
    link.tokenHash = tokenHash;
    link.type = type;
  }
  return link;
}

/** True when the fragment carries anything this module reads (so the page
 *  knows to clean the address bar). */
export function hasAuthFragment(hash: string): boolean {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return params.has('token_hash') || params.has('email');
}

/**
 * True when the fragment carries a ready-made Supabase session — what a
 * dashboard invite, magic link or email-confirmation redirect appends
 * (`#access_token=…&refresh_token=…`). The app does not sign in from these;
 * it removes them from the address bar so a live credential is not left in
 * the URL, the history, or a screenshot of a projected lab screen.
 */
export function hasSessionFragment(hash: string): boolean {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return params.has('access_token') || params.has('refresh_token');
}

/**
 * True when this page was reached by a navigation from the configured
 * account portal. Only then may a sign-in link be used without asking: a
 * link opened from an email, a chat or another site always gets an explicit
 * "Sign in as …?" first, because a stranger can mint a link to THEIR
 * account and send it to someone who is signed out here (login CSRF).
 * `document.referrer` cannot be set by the linking page to another origin.
 */
export function cameFromPortal(referrer: string, portalOrigin: string | null): boolean {
  if (!referrer || !portalOrigin) return false;
  try {
    return new URL(referrer).origin === portalOrigin;
  } catch {
    return false;
  }
}

