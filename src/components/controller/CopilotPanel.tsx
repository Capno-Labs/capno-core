'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyCopilotCommand,
  runCopilot,
  type CopilotProposal,
  type CopilotResult,
} from '@/lib/llm/copilot';
import { getLlmProvider } from '@/lib/llm/settings';
import { useControllerStore } from '@/lib/store/controllerStore';
import { useLlmConfigured, useLlmSettingsStore } from '@/lib/store/llmSettingsStore';

interface PendingProposal extends CopilotProposal {
  applied: boolean;
}

/**
 * Semantic co-pilot: faculty describe what should happen in plain language;
 * the LLM proposes structured commands which render as chips. Nothing touches
 * the sim until faculty apply a chip — the controller stays the single
 * authority and every applied command goes through the existing store
 * actions. Hidden entirely unless AI settings are configured (offline-first).
 */
export function CopilotPanel() {
  const configured = useLlmConfigured();
  const hydrate = useLlmSettingsStore((s) => s.hydrate);
  const store = useControllerStore();
  const { engine, snapshot } = store;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [result, setResult] = useState<Pick<CopilotResult, 'reply' | 'errors'> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!configured || !engine || !snapshot) return null;

  const propose = async () => {
    const request = input.trim();
    if (!request || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setProposals([]);
    setResult(null);

    const provider = getLlmProvider();
    if (!provider) {
      setLoading(false);
      return;
    }
    const res = await runCopilot(provider, engine.scenario, snapshot, request, controller.signal);
    if (controller.signal.aborted) return;
    setLoading(false);
    setProposals(res.proposals.map((p) => ({ ...p, applied: false })));
    setResult({ reply: res.reply, errors: res.errors });
    if (res.proposals.length > 0) setInput('');
  };

  const apply = (index: number) => {
    setProposals((prev) =>
      prev.map((p, i) => {
        if (i !== index || p.applied) return p;
        applyCopilotCommand(p.command, store);
        return { ...p, applied: true };
      }),
    );
  };

  const applyAll = () => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.applied) return p;
        applyCopilotCommand(p.command, store);
        return { ...p, applied: true };
      }),
    );
  };

  const dismiss = (index: number) => {
    setProposals((prev) => prev.filter((_, i) => i !== index));
  };

  const pendingCount = proposals.filter((p) => !p.applied).length;

  return (
    <section className="card space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
        ✨ Co-pilot <span className="font-normal normal-case text-slate-500">(AI proposes — you apply)</span>
      </h2>

      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void propose();
        }}
      >
        <input
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "SBP to 60s over 2 min, HR 135 sinus tach, fire the anaphylaxis event"'
          aria-label="Describe what should happen"
          disabled={loading}
        />
        <button type="submit" className="btn-primary text-xs" disabled={loading || !input.trim()}>
          {loading ? '…' : 'Propose'}
        </button>
      </form>

      {proposals.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Proposed commands
            </span>
            <span className="flex gap-2">
              {pendingCount > 1 && (
                <button className="text-xs text-emerald-400 hover:text-emerald-300" onClick={applyAll}>
                  Apply all ({pendingCount})
                </button>
              )}
              <button
                className="text-xs text-slate-500 hover:text-slate-300"
                onClick={() => setProposals([])}
              >
                Dismiss all
              </button>
            </span>
          </div>
          <ul className="space-y-1">
            {proposals.map((p, i) => (
              <li
                key={`${p.label}-${i}`}
                className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs ring-1 ${
                  p.applied
                    ? 'bg-slate-800/80 text-slate-500 ring-slate-700'
                    : 'bg-slate-900 text-slate-200 ring-sky-500/50'
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{p.label}</span>
                  {p.warnings.map((w) => (
                    <span key={w} className="block text-[10px] text-amber-400">
                      ⚠ {w}
                    </span>
                  ))}
                </span>
                <span className="flex shrink-0 gap-1">
                  {p.applied ? (
                    <span title="applied">✓ applied</span>
                  ) : (
                    <>
                      <button
                        className="rounded bg-emerald-900/60 px-2 py-0.5 font-semibold text-emerald-300 hover:bg-emerald-800/60"
                        onClick={() => apply(i)}
                      >
                        Apply
                      </button>
                      <button
                        className="rounded px-1.5 py-0.5 text-slate-500 hover:text-slate-300"
                        onClick={() => dismiss(i)}
                        aria-label={`Dismiss ${p.label}`}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.reply && <p className="text-xs text-slate-400">{result.reply}</p>}
      {result && result.errors.length > 0 && (
        <ul className="space-y-0.5">
          {result.errors.map((e) => (
            <li key={e} className="text-xs text-red-400">
              {e}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-slate-500">
        AI proposes — nothing changes until you apply. Verify against your scenario script.
      </p>
    </section>
  );
}
