import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Managed-gateway extension point. The contract under test:
 *  - env unset → behavior byte-identical to today (nothing configured)
 *  - env set + signed out → still nothing (no affordances, no provider)
 *  - env set + signed in → configured, gateway provider
 *  - saved BYO settings always win over the managed path
 * Auth state is set directly on the real store; the Supabase client is
 * mocked at the module boundary (same specifier for every importer).
 */

// vi.mock is hoisted above imports, so the state it closes over must be
// hoisted too (a plain `let` would still be in its temporal dead zone when
// authStore's module init calls supabaseConfigured()).
const mock = vi.hoisted(() => ({
  supabaseIsConfigured: true,
  getSession: vi.fn(),
}));

vi.mock('../sync/supabase', () => ({
  supabaseConfigured: () => mock.supabaseIsConfigured,
  getSupabase: () =>
    mock.supabaseIsConfigured ? { auth: { getSession: mock.getSession } } : null,
}));

import { useAuthStore } from '../cloud/authStore';
import { createGatewayProvider, gatewayConfigured, managedLlmEligible } from './gateway';
import { getLlmProvider, llmConfigured, saveLlmSettings } from './settings';

const GATEWAY_URL = 'https://start.capno.app/api/llm/v1';
const MODEL = 'anthropic/claude-sonnet-4.5';

function stubLocalStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

function configureGateway() {
  vi.stubEnv('NEXT_PUBLIC_LLM_GATEWAY_URL', GATEWAY_URL);
  vi.stubEnv('NEXT_PUBLIC_LLM_MODEL', MODEL);
}

function signIn() {
  useAuthStore.setState({
    status: 'signed_in',
    user: { id: 'u1', email: 'f@test.example' },
  });
}

function okResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe('managed gateway configuration', () => {
  beforeEach(() => {
    stubLocalStorage();
    mock.supabaseIsConfigured = true;
    mock.getSession.mockReset();
    useAuthStore.setState({ status: 'signed_out', user: null, profile: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('env unset → nothing changes: unconfigured, no provider, even signed in', () => {
    signIn();
    expect(gatewayConfigured()).toBe(false);
    expect(managedLlmEligible()).toBe(false);
    expect(llmConfigured()).toBe(false);
    expect(getLlmProvider()).toBeNull();
    expect(createGatewayProvider()).toBeNull();
  });

  it('needs BOTH env vars and Supabase', () => {
    signIn();
    vi.stubEnv('NEXT_PUBLIC_LLM_GATEWAY_URL', GATEWAY_URL);
    expect(gatewayConfigured()).toBe(false); // model missing
    vi.stubEnv('NEXT_PUBLIC_LLM_MODEL', MODEL);
    expect(gatewayConfigured()).toBe(true);
    mock.supabaseIsConfigured = false; // no token source → no gateway
    expect(gatewayConfigured()).toBe(false);
  });

  it('env set + signed out → zero AI affordances', () => {
    configureGateway();
    expect(gatewayConfigured()).toBe(true);
    expect(managedLlmEligible()).toBe(false);
    expect(llmConfigured()).toBe(false);
    expect(getLlmProvider()).toBeNull();
  });

  it('env set + signed in → configured with a gateway provider', () => {
    configureGateway();
    signIn();
    expect(managedLlmEligible()).toBe(true);
    expect(llmConfigured()).toBe(true);
    expect(getLlmProvider()?.kind).toBe('gateway');
  });

  it('saved BYO settings always win over the managed path', () => {
    configureGateway();
    signIn();
    saveLlmSettings({ apiKey: 'sk-or-own', model: 'openai/gpt-4o-mini' });
    expect(llmConfigured()).toBe(true);
    expect(getLlmProvider()?.kind).toBe('openrouter');
  });

  it('blank BYO settings fall through to the managed path', () => {
    configureGateway();
    signIn();
    saveLlmSettings({ apiKey: '   ', model: 'm' });
    expect(getLlmProvider()?.kind).toBe('gateway');
  });
});

describe('gateway provider requests', () => {
  beforeEach(() => {
    stubLocalStorage();
    mock.supabaseIsConfigured = true;
    mock.getSession.mockReset();
    configureGateway();
    signIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    useAuthStore.setState({ status: 'signed_out', user: null, profile: null });
  });

  it('POSTs to the gateway with the per-request session token and env model', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-abc' } } });
    const fetchMock = vi.fn(async () => okResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGatewayProvider();
    const result = await provider!.complete({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      maxTokens: 50,
      jsonMode: true,
    });

    expect(result).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      max_tokens: 50,
      response_format: { type: 'json_object' },
    });
  });

  it('throws a sign-in message when no session exists', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal('fetch', vi.fn());
    const provider = createGatewayProvider();
    await expect(
      provider!.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces gateway error messages (e.g. the entitlement 403)', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-abc' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: 'Managed AI is not included in your plan.' } }),
            { status: 403 },
          ),
      ),
    );
    const provider = createGatewayProvider();
    await expect(
      provider!.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/not included in your plan/);
  });
});
