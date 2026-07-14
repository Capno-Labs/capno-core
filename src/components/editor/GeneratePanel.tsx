'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DOCUMENT_CHAR_LIMIT,
  generateScenario,
  prepareDocument,
  type GenerateResult,
} from '@/lib/llm/generator';
import { getLlmProvider } from '@/lib/llm/settings';
import { useLlmConfigured, useLlmSettingsStore } from '@/lib/store/llmSettingsStore';

const MAX_ATTEMPTS = 3;

/**
 * "Generate with AI" affordance for the scenario editor. Produces a DRAFT
 * that lands in the JSON pane (dirty) — faculty still press Apply JSON and
 * Save, so nothing skips the existing validate/review/save pipeline.
 * Hidden entirely unless AI settings are configured.
 */
export function GeneratePanel({ onResult }: { onResult: (result: GenerateResult) => void }) {
  const configured = useLlmConfigured();
  const hydrate = useLlmSettingsStore((s) => s.hydrate);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [docOpen, setDocOpen] = useState(false);
  const [docText, setDocText] = useState('');
  const [docTruncated, setDocTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const docFileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!configured) return null;

  const generate = async () => {
    const request = prompt.trim();
    if (!request || loading) return;
    const provider = getLlmProvider();
    if (!provider) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setAttempt(1);

    const document = docText.trim() ? prepareDocument(docText).text : undefined;
    const result = await generateScenario(provider, request, {
      maxAttempts: MAX_ATTEMPTS,
      signal: controller.signal,
      onAttempt: setAttempt,
      ...(document ? { document } : {}),
    });
    if (controller.signal.aborted) return;
    setLoading(false);
    onResult(result);
  };

  const setDocument = (text: string) => {
    const prepared = prepareDocument(text);
    setDocText(prepared.text);
    setDocTruncated(prepared.truncated);
  };

  const loadDocFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setDocument(String(reader.result));
      setDocOpen(true);
    };
    reader.readAsText(file);
  };

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        ✨ Generate with AI
      </button>
    );
  }

  return (
    <section className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          ✨ Generate scenario draft
        </h2>
        <button
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          close
        </button>
      </div>
      <textarea
        className="input"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the scenario: presentation, patient, complications, difficulty, training level…"
        aria-label="Scenario description"
        disabled={loading}
      />
      <div className="space-y-2">
        <button
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => setDocOpen((v) => !v)}
          disabled={loading}
        >
          {docOpen ? '▼' : '▶'} Ground in a document (syllabus page, lab handout)
          {docText.trim() && !docOpen ? ' — attached' : ''}
        </button>
        {docOpen && (
          <div className="space-y-1">
            <textarea
              className="input"
              rows={6}
              value={docText}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Paste the document text here — objectives, drugs and doses, and the expected course will be drawn from it…"
              aria-label="Source document"
              disabled={loading}
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <button
                className="hover:text-slate-300"
                onClick={() => docFileInput.current?.click()}
                disabled={loading}
              >
                ⬆ Upload .txt / .md
              </button>
              <input
                ref={docFileInput}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadDocFile(f);
                  e.target.value = '';
                }}
              />
              <span>PDF or Word? Copy and paste the text instead.</span>
              {docText.length > 0 && (
                <span>
                  {docText.length.toLocaleString()} / {DOCUMENT_CHAR_LIMIT.toLocaleString()} chars
                </span>
              )}
              {docTruncated && (
                <span className="text-amber-400/90">Document was truncated to fit the limit.</span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => void generate()} disabled={loading || !prompt.trim()}>
          {loading ? 'Generating…' : 'Generate draft'}
        </button>
        {loading && (
          <span className="text-xs text-slate-400">
            {attempt > 1 ? `repairing (attempt ${attempt}/${MAX_ATTEMPTS})…` : 'drafting & validating…'}
          </span>
        )}
      </div>
      <p className="text-xs text-amber-400/90">
        AI-generated drafts are unreviewed. Faculty must review all clinical content — drug
        effects, vital-sign values, and timings — before use with learners.
      </p>
    </section>
  );
}
