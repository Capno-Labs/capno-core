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
 * `email` alone (no token) just prefills the sign-in form.
 *
 * The key names deliberately avoid `access_token`, `code` and `error*`,
 * which supabase-js intercepts on its own when it sees them in a URL.
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
