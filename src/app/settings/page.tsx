'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { createOpenRouterProvider, gatewayConfigured } from '@/lib/llm';
import { toast } from '@/lib/store/toastStore';
import { useLlmSettingsStore } from '@/lib/store/llmSettingsStore';

const MODEL_PLACEHOLDER = 'e.g. anthropic/claude-sonnet-4.5 or openai/gpt-4o-mini';

/**
 * Faculty settings — currently just the optional AI assistance (BYO
 * OpenRouter key). Everything here is optional: Capno runs fully offline
 * with nothing configured.
 */
export default function SettingsPage() {
  const { settings, hydrated, hydrate, save, clear } = useLlmSettingsStore();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => {
    if (!hydrated) return;
    setApiKey(settings?.apiKey ?? '');
    setModel(settings?.model ?? '');
    setBaseUrl(settings?.baseUrl ?? '');
  }, [hydrated, settings]);

  if (!hydrated) return null;

  const draft = {
    apiKey: apiKey.trim(),
    model: model.trim(),
    ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
  };
  const draftValid = Boolean(draft.apiKey && draft.model);

  const testConnection = async () => {
    if (!draftValid) return;
    setTesting(true);
    try {
      await createOpenRouterProvider(draft).complete({
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        maxTokens: 10,
      });
      toast('Connection OK — model responded.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Connection failed.', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <FacultyGate>
      <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
        <header>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← home
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </header>

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">AI assistance (optional)</h2>
            <p className="mt-1 text-sm text-slate-400">
              Optional. Capno works fully offline without this. When configured, AI features
              (sim co-pilot, scenario drafting) send scenario data and your typed prompts to
              OpenRouter using your own API key and model choice.
            </p>
            {gatewayConfigured() && !settings && (
              <p className="mt-2 rounded border border-emerald-900 bg-emerald-950/40 p-2 text-sm text-emerald-300">
                Managed AI is active on this deployment: signed-in accounts get the sim
                co-pilot and scenario drafting with no key — prompts go through your
                institution&apos;s gateway instead of your own OpenRouter account. Saving a
                key below overrides the managed gateway for this browser.
              </p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">OpenRouter API key</span>
            <input
              className="input w-full font-mono"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-…"
              autoComplete="off"
            />
            <span className="block text-xs text-slate-500">
              Stored only in this browser&apos;s localStorage — never sent anywhere except
              OpenRouter.
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Model</span>
            <input
              className="input w-full font-mono"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER}
            />
          </label>

          <details>
            <summary className="cursor-pointer text-sm text-slate-400">Advanced</summary>
            <label className="mt-2 block space-y-1">
              <span className="text-sm font-semibold">Base URL</span>
              <input
                className="input w-full font-mono"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
              />
              <span className="block text-xs text-slate-500">
                Only change this for a self-hosted OpenAI-compatible gateway.
              </span>
            </label>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={!draftValid}
              onClick={() => {
                save(draft);
                toast('AI settings saved.', 'success');
              }}
            >
              Save
            </button>
            <button className="btn" disabled={!draftValid || testing} onClick={testConnection}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button
              className="btn"
              disabled={!settings}
              onClick={() => {
                clear();
                toast('AI settings cleared — AI features disabled.', 'info');
              }}
            >
              Clear
            </button>
          </div>

          <p className="text-xs text-slate-500">
            AI output is simulation-authoring assistance only — not clinical guidance. All
            AI-generated content must be reviewed by faculty before use with learners.
            Simulation only — not for clinical use.
          </p>
        </section>
      </main>
    </FacultyGate>
  );
}
