import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * signInWithTokenHash is the receiving end of a cross-origin sign-in link.
 * The property under test: nothing is persisted, and no sign-in listener
 * (the outbox upload) runs, unless the token belongs to the account the
 * link named.
 */

const HASH = 'd'.repeat(56);

const real = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    setSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
};
const probe = { auth: { verifyOtp: vi.fn(), signOut: vi.fn() } };

vi.mock('../sync/supabase', () => ({
  supabaseConfigured: () => true,
  getSupabase: () => real,
  createEphemeralSupabase: () => probe,
}));

async function freshStore() {
  vi.resetModules();
  return import('./authStore');
}

beforeEach(() => {
  vi.clearAllMocks();
  real.auth.setSession.mockResolvedValue({ data: {}, error: null });
  real.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: { display_name: 'Ana', role: 'faculty' }, error: null }) }) }),
  });
  probe.auth.signOut.mockResolvedValue({ error: null });
  probe.auth.verifyOtp.mockResolvedValue({
    data: {
      user: { id: 'u1', email: 'Ana@Example.org' },
      session: { access_token: 'at', refresh_token: 'rt' },
    },
    error: null,
  });
});

describe('signInWithTokenHash', () => {
  it('adopts the session only after the identity matches the link (case-insensitive)', async () => {
    const { useAuthStore, onSignedIn } = await freshStore();
    const listener = vi.fn();
    onSignedIn(listener);

    const result = await useAuthStore.getState().signInWithTokenHash(HASH, 'magiclink', 'ana@example.org');

    expect(result).toEqual({ ok: true });
    expect(probe.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type: 'magiclink' });
    expect(real.auth.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(useAuthStore.getState().status).toBe('signed_in');
    expect(useAuthStore.getState().user).toEqual({ id: 'u1', email: 'Ana@Example.org' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('drops a token that belongs to a different account: nothing persisted, no listener, session revoked locally', async () => {
    const { useAuthStore, onSignedIn } = await freshStore();
    const listener = vi.fn();
    onSignedIn(listener);

    // The link said "victim@…", the token is the attacker's.
    const result = await useAuthStore.getState().signInWithTokenHash(HASH, 'magiclink', 'victim@example.org');

    expect(result.ok).toBe(false);
    expect(real.auth.setSession).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).not.toBe('signed_in');
    expect(probe.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never replaces an existing session', async () => {
    const { useAuthStore } = await freshStore();
    useAuthStore.setState({ status: 'signed_in', user: { id: 'me', email: 'me@example.org' } });

    const result = await useAuthStore.getState().signInWithTokenHash(HASH, 'magiclink', 'ana@example.org');

    expect(result.ok).toBe(false);
    expect(probe.auth.verifyOtp).not.toHaveBeenCalled();
    expect(real.auth.setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.id).toBe('me');
  });

  it('reports an expired or used token without persisting anything', async () => {
    probe.auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'expired' } });
    const { useAuthStore } = await freshStore();

    const result = await useAuthStore.getState().signInWithTokenHash(HASH, 'magiclink', 'ana@example.org');

    expect(result).toEqual({ ok: false, error: 'expired' });
    expect(real.auth.setSession).not.toHaveBeenCalled();
  });
});
