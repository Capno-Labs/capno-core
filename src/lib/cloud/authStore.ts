'use client';

import { create } from 'zustand';
import type { Role } from '../engine/types';
import { createEphemeralSupabase, getSupabase, supabaseConfigured } from '../sync/supabase';
import type { AuthLinkType } from './authLink';

/**
 * Institution sign-in (optional Supabase auth).
 *
 * Email/password on purpose: magic links behave badly in installed PWAs and
 * on shared lab machines. supabase-js persists the session in localStorage,
 * so a signed-in faculty member stays signed in offline — cloud pushes just
 * queue in the outbox until connectivity returns.
 *
 * Everything here no-ops when Supabase is not configured; the app remains
 * fully functional offline (the PIN gate is the no-backend fallback).
 */

export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in';

export interface AuthProfile {
  displayName: string;
  /** Null while the profile row could not be fetched (e.g. offline). */
  role: Role | null;
}

interface AuthState {
  status: AuthStatus;
  user: { id: string; email: string } | null;
  profile: AuthProfile | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Exchange a single-use sign-in link token (see authLink.ts) for a
   * session — but only if it turns out to belong to `expectedEmail`, the
   * account the link claimed and the user agreed to.
   */
  signInWithTokenHash: (
    tokenHash: string,
    type: AuthLinkType,
    expectedEmail: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

let initialized = false;
/** Callbacks run every time a user signs in (outbox drain hooks). */
const signInListeners = new Set<() => void>();

export function onSignedIn(listener: () => void): () => void {
  signInListeners.add(listener);
  return () => signInListeners.delete(listener);
}

async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return { displayName: data.display_name ?? '', role: (data.role as Role) ?? null };
}

/** Shared tail of every explicit sign-in: adopt the user, load the profile,
 *  run the sign-in listeners (outbox drain). */
async function completeSignIn(
  set: (partial: Partial<AuthState>) => void,
  user: { id: string; email?: string },
): Promise<void> {
  set({ status: 'signed_in', user: { id: user.id, email: user.email ?? '' } });
  const profile = await fetchProfile(user.id);
  set({ profile: profile ?? { displayName: '', role: null } });
  for (const l of signInListeners) l();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: supabaseConfigured() ? 'loading' : 'unconfigured',
  user: null,
  profile: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: 'unconfigured' });
      return;
    }
    const apply = async (sessionUser: { id: string; email?: string } | null) => {
      if (!sessionUser) {
        set({ status: 'signed_out', user: null, profile: null });
        return;
      }
      set({
        status: 'signed_in',
        user: { id: sessionUser.id, email: sessionUser.email ?? '' },
      });
      // Profile fetch can fail offline — degrade to role:null; the PIN gate
      // still works and cloud pushes stay queued.
      const profile = await fetchProfile(sessionUser.id);
      set({ profile: profile ?? { displayName: '', role: null } });
      for (const l of signInListeners) l();
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (get().status !== 'signed_in') void apply(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        set({ status: 'signed_out', user: null, profile: null });
      }
    });
  },

  signIn: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Sign-in failed.' };
    }
    await completeSignIn(set, data.user);
    return { ok: true };
  },

  signInWithTokenHash: async (tokenHash, type, expectedEmail) => {
    const supabase = getSupabase();
    const probe = createEphemeralSupabase();
    if (!supabase || !probe) return { ok: false, error: 'Supabase is not configured.' };
    // A link never replaces an existing session: a signed-in device stays on
    // its own account.
    if (get().status === 'signed_in') return { ok: false, error: 'Already signed in.' };

    // Exchange on a client that persists nothing, so no session is stored
    // and no sign-in listener (outbox upload) runs until we know WHOSE
    // session this is. A link that says one account but carries another's
    // token is dropped here and never reaches the real client.
    const { data, error } = await probe.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.user || !data.session) {
      return { ok: false, error: error?.message ?? 'Sign-in failed.' };
    }
    if ((data.user.email ?? '').toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      // Revoke just this session; never a global sign-out of that account.
      await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return { ok: false, error: 'This link is for a different account.' };
    }

    const adopted = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (adopted.error) return { ok: false, error: adopted.error.message };
    await completeSignIn(set, data.user);
    return { ok: true };
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    set({ status: 'signed_out', user: null, profile: null });
  },
}));

/** True when the signed-in account may push to institutional storage. */
export function isCloudFaculty(): boolean {
  const { status, profile } = useAuthStore.getState();
  return status === 'signed_in' && (profile?.role === 'faculty' || profile?.role === 'admin');
}
