'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { Poster } from '@/components/ui/Poster';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountPortalUrl, passwordResetUrl } from '@/lib/accountPortal';
import { hasAuthFragment, parseAuthFragment, type AuthLink } from '@/lib/cloud/authLink';
import { useAuthStore } from '@/lib/cloud/authStore';
import { queuedCount } from '@/lib/cloud/outbox';
import { DISPLAY_COPY } from '@/lib/displayCopy';
import { toast } from '@/lib/store/toastStore';

const BENEFITS = [
  'A shared case library for your program',
  'An institution-wide archive of debriefs',
  'The same cases on every lab device',
];

// Build-time constants (NEXT_PUBLIC_*): identical on server and client.
const signUpUrl = accountPortalUrl('/start');
const teamUrl = accountPortalUrl('/invites');
const resetUrl = passwordResetUrl();

/** What a sign-in link (see lib/cloud/authLink.ts) is doing on this page. */
type LinkPhase = 'idle' | 'confirm' | 'working' | 'failed';

/** Institution account: sign in/out and see your role. Optional — Capno runs fully without it. */
export default function AccountPage() {
  const { status, user, profile, init, signIn, signInWithTokenHash, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<AuthLink | null>(null);
  const [linkPhase, setLinkPhase] = useState<LinkPhase>('idle');
  const [queued, setQueued] = useState(0);
  // A token is single-use: never exchange it twice (StrictMode re-runs effects).
  const exchanged = useRef(false);

  useEffect(() => init(), [init]);

  // A sign-in link arrives in the URL fragment. Take it out of the address
  // bar (and history) before doing anything else with it.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hasAuthFragment(hash)) return;
    const parsed = parseAuthFragment(hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.tokenHash) setLink(parsed);
  }, []);

  const exchangeLink = async () => {
    if (!link?.tokenHash || !link.type || exchanged.current) return;
    exchanged.current = true;
    setLinkPhase('working');
    const result = await signInWithTokenHash(link.tokenHash, link.type);
    setLink(null);
    if (result.ok) {
      setLinkPhase('idle');
      const address = useAuthStore.getState().user?.email;
      toast(address ? `Signed in as ${address}` : 'Signed in', 'success');
    } else {
      setLinkPhase('failed');
    }
  };

  // Use the link only once the stored session is known, and only on a
  // signed-out device — a link never replaces an existing session. If this
  // device has unsynced work, signing in would upload it to the link's
  // account, so that needs an explicit yes instead of happening on arrival.
  useEffect(() => {
    if (!link?.tokenHash || linkPhase !== 'idle' || status === 'loading') return;
    if (status !== 'signed_out') {
      setLink(null);
      return;
    }
    const waiting = queuedCount();
    if (waiting > 0) {
      setQueued(waiting);
      setLinkPhase('confirm');
    } else {
      void exchangeLink();
    }
    // exchangeLink is recreated each render; the guards above make this safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, linkPhase, status]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (!result.ok) setError(result.error ?? 'Sign-in failed.');
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <Poster
        compact
        label="Institution account"
        titleLines={[...DISPLAY_COPY.account]}
        promise="Signing in is optional. Everything works offline on this device without an account."
      >
        <ul className="space-y-2 border-t border-poster-line/40 pt-4 text-sm text-white">
          {BENEFITS.map((b, i) => (
            <li key={b} className="flex gap-3">
              <span aria-hidden className="font-mono text-xs text-poster-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              {b}
            </li>
          ))}
        </ul>
      </Poster>

      <div className="space-y-4">
        {linkPhase === 'confirm' && (
          <Callout
            tone="info"
            title="Sign in with this link?"
            actions={
              <>
                <Button variant="primary" size="sm" onClick={() => void exchangeLink()}>
                  Sign in
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLink(null);
                    setLinkPhase('idle');
                  }}
                >
                  Not now
                </Button>
              </>
            }
          >
            This device has {queued} unsynced {queued === 1 ? 'change' : 'changes'}. After signing
            in, {queued === 1 ? 'it' : 'they'} will upload to that account.
          </Callout>
        )}
        {linkPhase === 'failed' && (
          <Callout tone="warn" title="That sign-in link has expired or was already used">
            Sign in with your password instead.
          </Callout>
        )}

        {status === 'unconfigured' && (
          <div className="card space-y-2 text-sm text-muted">
            <h2 className="text-base font-bold text-ink">Not set up on this installation</h2>
            <p>
              Institution sign-in is not configured here. Capno runs fully on this device —
              scenarios and debriefs are stored in this browser.
            </p>
            <p>
              To enable shared scenario storage and an institution-wide session archive, deploy
              with a Supabase backend (see{' '}
              <span className="font-mono text-ink-2">docs/DEPLOYMENT.md</span>).
            </p>
          </div>
        )}

        {(status === 'loading' || linkPhase === 'working') && (
          <div className="card space-y-4" role="status">
            <span className="sr-only">
              {linkPhase === 'working' ? 'Signing you in…' : 'Checking session…'}
            </span>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full !rounded-full" />
          </div>
        )}

        {status === 'signed_out' && linkPhase !== 'working' && (
          <form onSubmit={submit} className="card space-y-4">
            <h2 className="text-base font-bold">Sign in with your institution account</h2>
            {error && <Callout tone="danger">{error}</Callout>}
            <Field label="Email">
              <input
                className="input"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {resetUrl && (
              <p className="-mt-2 text-right text-xs">
                <a className="link" href={resetUrl}>
                  Forgot password?
                </a>
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={busy}
              loadingLabel="Signing in…"
            >
              Sign in
            </Button>
            <p className="text-center text-sm text-muted">
              {signUpUrl ? (
                <>
                  New to CAPNO Studio?{' '}
                  <a className="link" href={signUpUrl}>
                    Get started →
                  </a>
                </>
              ) : (
                'Accounts are created by your program administrator.'
              )}
            </p>
          </form>
        )}

        {status === 'signed_in' && user && (
          <div className="card space-y-4">
            <div>
              <span className="label">Signed in as</span>
              <p className="break-all font-mono text-sm">{user.email}</p>
            </div>
            <div>
              <span className="label">Role</span>
              {profile?.role ? (
                <Pill tone={profile.role === 'student' ? 'neutral' : 'green'} className="uppercase tracking-wider">
                  {profile.role}
                </Pill>
              ) : (
                <p className="text-sm text-faint">Unknown (profile unavailable — offline?)</p>
              )}
            </div>
            {profile?.role === 'student' && (
              <Callout tone="warn">
                This account has no faculty permissions — saved scenarios and sessions stay on
                this device only. Ask your program administrator to promote your account to
                faculty.
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              {teamUrl && (profile?.role === 'faculty' || profile?.role === 'admin') && (
                <Button variant="secondary" href={teamUrl} external icon="external">
                  Manage team
                </Button>
              )}
              <Button variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
