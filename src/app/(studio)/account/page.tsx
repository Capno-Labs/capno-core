'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Pill';
import { Poster } from '@/components/ui/Poster';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountPortalUrl, passwordResetUrl } from '@/lib/accountPortal';
import { useAuthStore } from '@/lib/cloud/authStore';
import { DISPLAY_COPY } from '@/lib/displayCopy';

const BENEFITS = [
  'A shared case library for your program',
  'An institution-wide archive of debriefs',
  'The same cases on every lab device',
];

// Build-time constants (NEXT_PUBLIC_*): identical on server and client.
const signUpUrl = accountPortalUrl('/start');
const teamUrl = accountPortalUrl('/invites');
const resetUrl = passwordResetUrl();

/** Institution account: sign in/out and see your role. Optional — Capno runs fully without it. */
export default function AccountPage() {
  const { status, user, profile, init, signIn, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Messages from flows that land on this page (reserved for sign-in links).
  const [notice] = useState<ReactNode>(null);

  useEffect(() => init(), [init]);

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
        {notice}

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

        {status === 'loading' && (
          <div className="card space-y-4" role="status">
            <span className="sr-only">Checking session…</span>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full !rounded-full" />
          </div>
        )}

        {status === 'signed_out' && (
          <form onSubmit={submit} className="card space-y-4" noValidate={false}>
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
