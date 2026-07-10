'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@/lib/cloud/authStore';

/** Institution account: sign in/out and see your role. Optional — Capno runs fully without it. */
export default function AccountPage() {
  const { status, user, profile, init, signIn, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
        ← home
      </Link>
      <h1 className="text-2xl font-bold">Institution account</h1>

      {status === 'unconfigured' && (
        <div className="card space-y-2 text-sm text-slate-400">
          <p>
            Institution sign-in is not configured on this installation. Capno runs fully on this
            device — scenarios and debriefs are stored in this browser.
          </p>
          <p>
            To enable shared scenario storage and an institution-wide session archive, deploy with
            a Supabase backend (see <span className="font-mono text-slate-300">docs/DEPLOYMENT.md</span>).
          </p>
        </div>
      )}

      {status === 'loading' && <div className="card text-sm text-slate-400">Checking session…</div>}

      {status === 'signed_out' && (
        <form onSubmit={submit} className="card space-y-4">
          <p className="text-sm text-slate-400">
            Sign in with your institution account. Accounts are created by your program
            administrator.
          </p>
          <div>
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {status === 'signed_in' && user && (
        <div className="card space-y-3">
          <div>
            <span className="label">Signed in as</span>
            <p className="font-mono text-sm">{user.email}</p>
          </div>
          <div>
            <span className="label">Role</span>
            <p className="text-sm">
              {profile?.role ? (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    profile.role === 'student'
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-emerald-900 text-emerald-300'
                  }`}
                >
                  {profile.role}
                </span>
              ) : (
                <span className="text-slate-500">unknown (profile unavailable — offline?)</span>
              )}
            </p>
          </div>
          {profile?.role === 'student' && (
            <p className="text-sm text-amber-400">
              This account has no faculty permissions — saved scenarios and sessions stay on this
              device only. Ask your program administrator to promote your account to faculty.
            </p>
          )}
          <button className="btn-secondary w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        Signing in is optional. Everything works offline on this device without an account.
      </p>
    </main>
  );
}
