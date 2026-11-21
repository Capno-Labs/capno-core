'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { hasSessionFragment } from '@/lib/cloud/authLink';
import { toast } from '@/lib/store/toastStore';
import { supabaseConfigured } from '@/lib/sync/supabase';

/**
 * The app never signs in from session tokens in the URL (see
 * `getSupabase`). When a link arrives carrying them anyway — a Supabase
 * dashboard invite or magic link, an email-confirmation redirect — take
 * them out of the address bar and say what to do instead.
 */
export function AuthUrlGuard() {
  const router = useRouter();
  useEffect(() => {
    if (!hasSessionFragment(window.location.hash)) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!supabaseConfigured()) return;
    toast(
      'Sign-in links are not accepted here. Sign in with your email and password.',
      'info',
      window.location.pathname === '/account'
        ? undefined
        : { label: 'Sign in', onClick: () => router.push('/account') },
    );
  }, [router]);
  return null;
}
