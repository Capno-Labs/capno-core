'use client';

import { create } from 'zustand';
import type { LlmSettings } from '../llm/types';
import { gatewayConfigured } from '../llm/gateway';
import { clearLlmSettings, loadLlmSettings, saveLlmSettings } from '../llm/settings';
import { useAuthStore } from '../cloud/authStore';

/**
 * Reactive wrapper around the localStorage-backed LLM settings so components
 * (copilot panel, generate button) can show/hide as settings change without a
 * reload. Components must gate on `hydrated` before trusting `settings` —
 * same hydration-flash pattern as FacultyGate's `unlocked === null` state.
 */

interface LlmSettingsState {
  settings: LlmSettings | null;
  hydrated: boolean;
  hydrate: () => void;
  save: (settings: LlmSettings) => void;
  clear: () => void;
}

export const useLlmSettingsStore = create<LlmSettingsState>((set) => ({
  settings: null,
  hydrated: false,

  hydrate: () => {
    set({ settings: loadLlmSettings(), hydrated: true });
  },

  save: (settings) => {
    saveLlmSettings(settings);
    set({ settings, hydrated: true });
  },

  clear: () => {
    clearLlmSettings();
    set({ settings: null, hydrated: true });
  },
}));

/**
 * True once a usable key + model is hydrated, OR the build ships a managed
 * gateway and the user is signed in (the reactive mirror of
 * `llmConfigured()` — see gateway.ts). Gates every LLM affordance.
 */
export function useLlmConfigured(): boolean {
  const byo = useLlmSettingsStore(
    (s) => s.hydrated && Boolean(s.settings?.apiKey.trim() && s.settings?.model.trim()),
  );
  const signedIn = useAuthStore((s) => s.status === 'signed_in');
  return byo || (gatewayConfigured() && signedIn);
}
