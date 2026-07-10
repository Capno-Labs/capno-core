import type { LlmProvider, LlmRequest, LlmSettings } from './types';

/**
 * OpenRouter adapter — plain fetch against the OpenAI-compatible
 * chat-completions endpoint. No SDK dependency on purpose: one POST with a
 * bearer key is all we need, and the response is parsed defensively because
 * callers re-validate everything (JSON mode is best-effort on some models).
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const DEFAULT_TIMEOUT_MS = 90_000;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

export function createOpenRouterProvider(settings: LlmSettings): LlmProvider {
  const baseUrl = (settings.baseUrl?.trim() || OPENROUTER_BASE_URL).replace(/\/+$/, '');

  return {
    kind: 'openrouter',
    async complete(request: LlmRequest): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'CAPNO Studio',
        },
        body: JSON.stringify({
          model: settings.model,
          messages: request.messages,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: request.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      let data: ChatCompletionResponse | null = null;
      try {
        data = (await response.json()) as ChatCompletionResponse;
      } catch {
        // Non-JSON body; fall through to the status check below.
      }

      if (!response.ok) {
        const detail = data?.error?.message ? `: ${data.error.message}` : '';
        throw new Error(`LLM request failed (HTTP ${response.status})${detail}`);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('LLM response contained no message content.');
      }
      return content;
    },
  };
}
