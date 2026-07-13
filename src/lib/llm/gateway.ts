import { getSupabase, supabaseConfigured } from '../sync/supabase';
import { useAuthStore } from '../cloud/authStore';
import type { LlmProvider, LlmRequest } from './types';

/**
 * Managed LLM gateway — the hosted-deployment counterpart of the BYO key
 * (the "LLM gateway through env vars" carve-out in invariant 5). When a
 * build ships NEXT_PUBLIC_LLM_GATEWAY_URL + NEXT_PUBLIC_LLM_MODEL and
 * Supabase sign-in is configured, signed-in users get AI assistance with no
 * key: requests go to the deployment's OpenAI-compatible gateway,
 * authenticated per request with the user's own Supabase session token.
 *
 * The env vars are a URL and a model name — not secrets — so this does not
 * conflict with the settings-store rule that keys never live in
 * NEXT_PUBLIC_. Saved BYO settings always take precedence (see settings.ts),
 * and an unset gateway leaves behavior byte-identical to today: offline-
 * first, zero AI affordances, zero network calls.
 */

const DEFAULT_TIMEOUT_MS = 90_000;

export function gatewayConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_LLM_GATEWAY_URL &&
      process.env.NEXT_PUBLIC_LLM_MODEL &&
      supabaseConfigured(), // the session token is the credential
  );
}

/** Gateway is configured AND the user is signed in — the managed analog of
 *  "a usable key is saved". Signed-out users see zero AI affordances. */
export function managedLlmEligible(): boolean {
  return gatewayConfigured() && useAuthStore.getState().status === 'signed_in';
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

export function createGatewayProvider(): LlmProvider | null {
  if (!gatewayConfigured()) return null;
  const baseUrl = (process.env.NEXT_PUBLIC_LLM_GATEWAY_URL ?? '').replace(/\/+$/, '');
  const model = process.env.NEXT_PUBLIC_LLM_MODEL ?? '';

  return {
    kind: 'gateway',
    async complete(request: LlmRequest): Promise<string> {
      // Token resolved per request (not at provider creation) so supabase-js
      // refresh keeps working and sign-out immediately cuts access.
      const supabase = getSupabase();
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) {
        throw new Error('Sign in to your institution account to use AI assistance.');
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Title': 'CAPNO Studio',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: request.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      let data2: ChatCompletionResponse | null = null;
      try {
        data2 = (await response.json()) as ChatCompletionResponse;
      } catch {
        // Non-JSON body; fall through to the status check below.
      }

      if (!response.ok) {
        const detail = data2?.error?.message ? `: ${data2.error.message}` : '';
        throw new Error(`LLM request failed (HTTP ${response.status})${detail}`);
      }

      const content = data2?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('LLM response contained no message content.');
      }
      return content;
    },
  };
}
