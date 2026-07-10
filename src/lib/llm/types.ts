/**
 * Optional LLM assistance (semantic co-pilot + scenario generation).
 *
 * Mirrors the sync-layer adapter pattern: a tiny provider interface, one
 * concrete implementation (OpenRouter), and an `llmConfigured()` gate so
 * that with no key configured the app stays fully offline and no LLM
 * affordance renders anywhere. The LLM only ever *proposes* — every
 * command is validated client-side and applied by faculty through the
 * existing controller actions.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: ChatMessage[];
  /** Ask the provider for a JSON-object response (best-effort; callers always validate). */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly kind: 'openrouter' | 'fake';
  /** Resolves to the assistant message content; throws on HTTP/API failure. */
  complete(request: LlmRequest): Promise<string>;
}

export interface LlmSettings {
  apiKey: string;
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-4.5". */
  model: string;
  /** Override for self-hosted gateways; defaults to the public OpenRouter URL. */
  baseUrl?: string;
}
