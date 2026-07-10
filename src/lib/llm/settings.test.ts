import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLlmSettings,
  llmConfigured,
  loadLlmSettings,
  saveLlmSettings,
  getLlmProvider,
} from './settings';

// Vitest runs in a Node environment; stub the minimal localStorage surface
// the settings store touches, hung off a fake `window`.
function stubLocalStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  vi.stubGlobal('window', { localStorage: storage });
  return map;
}

describe('llm settings store', () => {
  let map: Map<string, string>;

  beforeEach(() => {
    map = stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips settings', () => {
    saveLlmSettings({ apiKey: 'sk-or-abc', model: 'anthropic/claude-sonnet-4.5' });
    expect(loadLlmSettings()).toEqual({
      apiKey: 'sk-or-abc',
      model: 'anthropic/claude-sonnet-4.5',
    });
    expect(llmConfigured()).toBe(true);
    expect(getLlmProvider()?.kind).toBe('openrouter');
  });

  it('preserves a custom base URL and drops a blank one', () => {
    saveLlmSettings({ apiKey: 'k', model: 'm', baseUrl: 'https://gw.example.com/v1' });
    expect(loadLlmSettings()?.baseUrl).toBe('https://gw.example.com/v1');
    saveLlmSettings({ apiKey: 'k', model: 'm', baseUrl: '   ' });
    expect(loadLlmSettings()?.baseUrl).toBeUndefined();
  });

  it('is unconfigured when nothing is saved', () => {
    expect(loadLlmSettings()).toBeNull();
    expect(llmConfigured()).toBe(false);
    expect(getLlmProvider()).toBeNull();
  });

  it('is unconfigured when key or model is blank', () => {
    saveLlmSettings({ apiKey: '   ', model: 'm' });
    expect(llmConfigured()).toBe(false);
    expect(getLlmProvider()).toBeNull();
    saveLlmSettings({ apiKey: 'k', model: '' });
    expect(llmConfigured()).toBe(false);
  });

  it('tolerates corrupted JSON', () => {
    map.set('capno:llm-settings:v1', '{not json');
    expect(loadLlmSettings()).toBeNull();
    expect(llmConfigured()).toBe(false);
  });

  it('tolerates a wrong-shape record', () => {
    map.set('capno:llm-settings:v1', JSON.stringify({ apiKey: 42 }));
    expect(loadLlmSettings()).toBeNull();
  });

  it('migrates settings saved under the pre-rename labsim key', () => {
    map.set('labsim:llm-settings:v1', JSON.stringify({ apiKey: 'k', model: 'm' }));
    expect(loadLlmSettings()).toEqual({ apiKey: 'k', model: 'm' });
    expect(map.has('labsim:llm-settings:v1')).toBe(false);
    expect(map.has('capno:llm-settings:v1')).toBe(true);
  });

  it('clears settings', () => {
    saveLlmSettings({ apiKey: 'k', model: 'm' });
    clearLlmSettings();
    expect(loadLlmSettings()).toBeNull();
  });
});
