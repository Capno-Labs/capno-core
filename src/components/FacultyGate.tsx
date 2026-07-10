'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@/lib/cloud/authStore';
import { supabaseConfigured } from '@/lib/sync/supabase';

const PIN = process.env.NEXT_PUBLIC_FACULTY_PIN;
const UNLOCK_KEY = 'capno:faculty-unlocked';

/**
 * Lightweight faculty gate. Precedence:
 *   1. Signed in with a faculty/admin institution account → unlocked.
 *   2. NEXT_PUBLIC_FACULTY_PIN set → ask for it once per browser session.
 *      This is advisory only (the PIN is a public client-side value) — it
 *      keeps students from casually opening the controller in a lab; real
 *      access control comes from Supabase auth+RLS.
 *   3. Neither configured → open.
 */
export function FacultyGate({ children }: { children: React.ReactNode }) {
  const { status, profile, init } = useAuthStore();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (supabaseConfigured()) init();
  }, [init]);

  useEffect(() => {
    if (!PIN) {
      setUnlocked(true);
      return;
    }
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === '1');
  }, []);

  const authUnlocked =
    status === 'signed_in' && (profile?.role === 'faculty' || profile?.role === 'admin');

  if (authUnlocked) return <>{children}</>;
  if (unlocked === null) return null; // avoid hydration flash
  if (unlocked) return <>{children}</>;
  // While auth is restoring a persisted session, don't flash the PIN form.
  if (status === 'loading') return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (attempt === PIN) {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      setUnlocked(true);
    } else {
      setError(true);
      setAttempt('');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-lg font-bold">Faculty access</h1>
        <p className="text-sm text-slate-400">Enter the faculty PIN for this installation.</p>
        <input
          className="input text-center font-mono text-xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoFocus
          value={attempt}
          onChange={(e) => {
            setAttempt(e.target.value);
            setError(false);
          }}
          aria-label="Faculty PIN"
        />
        {error && <p className="text-sm text-red-400">Incorrect PIN.</p>}
        <button type="submit" className="btn-primary w-full">
          Unlock
        </button>
        {supabaseConfigured() && (
          <Link
            href="/account"
            className="block text-center text-xs text-sky-400 hover:text-sky-300"
          >
            or sign in with your institution account →
          </Link>
        )}
      </form>
    </main>
  );
}
