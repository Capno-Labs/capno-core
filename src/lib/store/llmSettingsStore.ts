'use client';

import { create } from 'zustand';
import type { LlmSettings } from '../llm/types';
import { clearLlmSettings, loadLlmSettings, saveLlmSettings } from '../llm/settings';

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

/** True once hydrated with a usable key + model. Gates every LLM affordance. */
export function useLlmConfigured(): boolean {
  return useLlmSettingsStore(
    (s) => s.hydrated && Boolean(s.settings?.apiKey.trim() && s.settings?.model.trim()),
  );
}
