import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn((..._args: unknown[]) => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('supabase clients', () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('never adopts a session from the URL on the shared client', async () => {
    const { getSupabase } = await import('./supabase');
    getSupabase();
    getSupabase();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][2]).toMatchObject({
      auth: { detectSessionInUrl: false },
    });
    // The signed-in session must still persist for offline use.
    const auth = (createClient.mock.calls[0][2] as { auth: Record<string, unknown> }).auth;
    expect(auth.persistSession).toBeUndefined();
  });

  it('keeps the ephemeral client storage-free and URL-blind', async () => {
    const { createEphemeralSupabase } = await import('./supabase');
    createEphemeralSupabase();
    expect(createClient.mock.calls[0][2]).toEqual({
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  it('creates nothing when unconfigured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const { getSupabase, createEphemeralSupabase } = await import('./supabase');
    expect(getSupabase()).toBeNull();
    expect(createEphemeralSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
