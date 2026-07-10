import { migrateLegacyKey } from '../legacyStorage';
import { createOpenRouterProvider } from './openrouter';
import type { LlmProvider, LlmSettings } from './types';

/**
 * BYO-key LLM settings, persisted in this browser's localStorage only.
 * Runtime-mutable analog of `supabaseConfigured()`: with nothing saved,
 * every LLM affordance is hidden and no network request is ever made.
 *
 * The key deliberately lives in localStorage (entered by faculty at
 * runtime), never in a NEXT_PUBLIC_ env var — env vars are inlined into
 * the shipped bundle at build time.
 */

const KEY = 'capno:llm-settings:v1';

export function loadLlmSettings(): LlmSettings | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyKey(KEY);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    if (typeof parsed.apiKey !== 'string' || typeof parsed.model !== 'string') return null;
    return {
      apiKey: parsed.apiKey,
      model: parsed.model,
      ...(typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
        ? { baseUrl: parsed.baseUrl }
        : {}),
    };
  } catch {
    return null;
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

export function clearLlmSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

export function llmConfigured(): boolean {
  const settings = loadLlmSettings();
  return Boolean(settings && settings.apiKey.trim() && settings.model.trim());
}

export function getLlmProvider(): LlmProvider | null {
  const settings = loadLlmSettings();
  if (!settings || !settings.apiKey.trim() || !settings.model.trim()) return null;
  return createOpenRouterProvider(settings);
}
