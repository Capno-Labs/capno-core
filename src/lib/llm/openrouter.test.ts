import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPENROUTER_BASE_URL, createOpenRouterProvider } from './openrouter';

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

describe('openrouter provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the expected request shape and returns content', async () => {
    const fetchMock = vi.fn(async () => okResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenRouterProvider({ apiKey: 'sk-or-key', model: 'test/model' });
    const result = await provider.complete({
      messages: [{ role: 'user', content: 'hi' }],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 100,
    });

    expect(result).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-or-key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'test/model',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });
  });

  it('omits json response_format when jsonMode is off', async () => {
    const fetchMock = vi.fn(async () => okResponse('x'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createOpenRouterProvider({ apiKey: 'k', model: 'm' });
    await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.response_format).toBeUndefined();
  });

  it('respects a custom base URL with trailing slash', async () => {
    const fetchMock = vi.fn(async () => okResponse('x'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createOpenRouterProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://gw.example.com/v1/',
    });
    await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://gw.example.com/v1/chat/completions',
    );
  });

  it('surfaces API error messages on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Invalid key' } }),
        }) as Response,
      ),
    );
    const provider = createOpenRouterProvider({ apiKey: 'bad', model: 'm' });
    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/HTTP 401.*Invalid key/);
  });

  it('throws when the response has no content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({ ok: true, status: 200, json: async () => ({ choices: [] }) }) as Response,
      ),
    );
    const provider = createOpenRouterProvider({ apiKey: 'k', model: 'm' });
    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/no message content/);
  });
});
