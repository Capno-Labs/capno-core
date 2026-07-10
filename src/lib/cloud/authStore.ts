'use client';

import { create } from 'zustand';
import type { Role } from '../engine/types';
import { getSupabase, supabaseConfigured } from '../sync/supabase';

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
    set({ status: 'signed_in', user: { id: data.user.id, email: data.user.email ?? '' } });
    const profile = await fetchProfile(data.user.id);
    set({ profile: profile ?? { displayName: '', role: null } });
    for (const l of signInListeners) l();
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
