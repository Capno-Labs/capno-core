'use client';

import { useEffect, useRef, useState } from 'react';
import { generateScenario, prepareDocument, DOCUMENT_CHAR_LIMIT } from '@/lib/llm/generator';
import { getLlmProvider } from '@/lib/llm/settings';
import { extractSyllabusLabs, uniquifyDraftId, type SyllabusLab } from '@/lib/llm/syllabus';
import {
  BUILT_IN_SCENARIOS,
  addToCollection,
  createCollection,
  listCustomScenarios,
  saveCustomScenario,
} from '@/lib/scenarios';
import { useLlmConfigured, useLlmSettingsStore } from '@/lib/store/llmSettingsStore';
import { toast } from '@/lib/store/toastStore';

type Step = 'input' | 'extracting' | 'pick' | 'drafting' | 'done';

interface DraftOutcome {
  title: string;
  ok: boolean;
  error?: string;
}

/**
 * "Draft from syllabus" for the case library: paste a syllabus or lab
 * schedule, the LLM lists the sim sessions it describes, faculty pick which
 * to draft, and each becomes an ai-generated scenario draft grounded in the
 * document — assembled into a new collection. Hidden entirely unless AI
 * settings are configured; drafts go through the same validate/tag/review
 * pipeline as the editor's Generate panel.
 */
export function SyllabusImportPanel({ onChanged }: { onChanged: () => void }) {
  const configured = useLlmConfigured();
  const hydrate = useLlmSettingsStore((s) => s.hydrate);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [docText, setDocText] = useState('');
  const [docTruncated, setDocTruncated] = useState(false);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [labs, setLabs] = useState<SyllabusLab[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, attempt: 1, label: '' });
  const [outcomes, setOutcomes] = useState<DraftOutcome[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!configured) return null;

  const setDocument = (text: string) => {
    const prepared = prepareDocument(text);
    setDocText(prepared.text);
    setDocTruncated(prepared.truncated);
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setDocument(String(reader.result));
      if (!collectionTitle.trim()) {
        setCollectionTitle(file.name.replace(/\.(txt|md)$/i, '').trim());
      }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setStep('input');
    setLabs([]);
    setChecked([]);
    setOutcomes([]);
  };

  const extract = async () => {
    const provider = getLlmProvider();
    if (!provider || !docText.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep('extracting');
    const result = await extractSyllabusLabs(provider, docText, { signal: controller.signal });
    if (controller.signal.aborted) return;
    if (!result.ok) {
      setStep('input');
      toast(`Could not read the syllabus: ${result.errors[0]}`, 'error');
      return;
    }
    setLabs(result.labs);
    setChecked(result.labs.map(() => true));
    setStep('pick');
  };

  const draftAll = async () => {
    const provider = getLlmProvider();
    if (!provider) return;
    const selected = labs.filter((_, i) => checked[i]);
    if (selected.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep('drafting');

    const taken = new Set([
      ...BUILT_IN_SCENARIOS.map((s) => s.id),
      ...listCustomScenarios().map((s) => s.id),
    ]);
    // Created lazily on the first successful draft so a fully failed run
    // doesn't leave an empty collection behind.
    let collectionId: string | null = null;
    const results: DraftOutcome[] = [];

    // Sequential on purpose: keeps provider rate limits happy and makes
    // aborting mid-run keep every completed draft.
    for (let i = 0; i < selected.length; i++) {
      if (controller.signal.aborted) break;
      const lab = selected[i];
      setProgress({ current: i + 1, total: selected.length, attempt: 1, label: lab.title });
      const result = await generateScenario(provider, lab.prompt, {
        document: docText,
        signal: controller.signal,
        onAttempt: (attempt) => setProgress((p) => ({ ...p, attempt })),
      });
      if (controller.signal.aborted) break;
      if (!result.ok) {
        results.push({ title: lab.title, ok: false, error: result.errors[0] });
        setOutcomes([...results]);
        continue;
      }
      const id = uniquifyDraftId(result.scenario.id, taken);
      const saved = saveCustomScenario({ ...result.scenario, id });
      if (!saved.ok) {
        results.push({ title: lab.title, ok: false, error: saved.error });
        setOutcomes([...results]);
        toast(saved.error, 'error');
        break;
      }
      taken.add(id);
      if (!collectionId) {
        const created = createCollection(collectionTitle.trim() || 'Syllabus drafts');
        if (!created) {
          toast('Could not save the collection — device storage may be full.', 'error');
          break;
        }
        collectionId = created.id;
      }
      addToCollection(collectionId, id);
      results.push({ title: lab.title, ok: true });
      setOutcomes([...results]);
      onChanged(); // drafts appear in the library as they land
    }

    setStep('done');
    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      toast(
        `Drafted ${okCount} of ${selected.length} scenario${selected.length === 1 ? '' : 's'} into “${
          collectionTitle.trim() || 'Syllabus drafts'
        }” — review before use with learners`,
        'success',
      );
    }
    onChanged();
  };

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        ✨ Draft from syllabus
      </button>
    );
  }

  return (
    <section className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          ✨ Draft a collection from your syllabus
        </h2>
        <button
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => {
            abortRef.current?.abort();
            setOpen(false);
            reset();
          }}
        >
          close
        </button>
      </div>

      {step === 'input' && (
        <>
          <textarea
            className="input"
            rows={8}
            value={docText}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="Paste your syllabus or lab schedule — each sim session it describes becomes a scenario draft…"
            aria-label="Syllabus document"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <button className="hover:text-slate-300" onClick={() => fileInput.current?.click()}>
              ⬆ Upload .txt / .md
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-64"
              value={collectionTitle}
              onChange={(e) => setCollectionTitle(e.target.value)}
              placeholder="Collection title (e.g. CA-1 fall block)"
              aria-label="Collection title"
            />
            <button className="btn-primary" onClick={() => void extract()} disabled={!docText.trim()}>
              Find labs
            </button>
          </div>
        </>
      )}

      {step === 'extracting' && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>Reading the document…</span>
          <button className="btn-ghost" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        </div>
      )}

      {step === 'pick' && (
        <>
          <p className="text-sm text-slate-400">
            Found {labs.length} lab session{labs.length === 1 ? '' : 's'}. Pick which to draft:
          </p>
          <ul className="space-y-2">
            {labs.map((lab, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input
                  id={`syllabus-lab-${i}`}
                  type="checkbox"
                  className="mt-1"
                  checked={checked[i] ?? false}
                  onChange={(e) =>
                    setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                  }
                />
                <label htmlFor={`syllabus-lab-${i}`} className="min-w-0">
                  <span className="font-semibold text-slate-200">{lab.title}</span>
                  <span className="block text-xs text-slate-500">{lab.prompt}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              onClick={() => void draftAll()}
              disabled={checked.every((c) => !c)}
            >
              Draft {checked.filter(Boolean).length} scenario
              {checked.filter(Boolean).length === 1 ? '' : 's'}
            </button>
            <button className="btn-ghost" onClick={reset}>
              Back
            </button>
          </div>
        </>
      )}

      {(step === 'drafting' || step === 'done') && (
        <>
          {step === 'drafting' && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>
                Drafting {progress.current} of {progress.total}: “{progress.label}”
                {progress.attempt > 1 ? ` (repairing, attempt ${progress.attempt})` : ''}…
              </span>
              <button className="btn-ghost" onClick={() => abortRef.current?.abort()}>
                Stop (keeps finished drafts)
              </button>
            </div>
          )}
          {outcomes.length > 0 && (
            <ul className="space-y-1 text-xs">
              {outcomes.map((o, i) => (
                <li key={i} className={o.ok ? 'text-emerald-400' : 'text-red-400'}>
                  {o.ok ? '✓' : '✕'} {o.title}
                  {o.error ? ` — ${o.error}` : ''}
                </li>
              ))}
            </ul>
          )}
          {step === 'done' && (
            <button className="btn-ghost" onClick={reset}>
              Start over
            </button>
          )}
        </>
      )}

      <p className="text-xs text-amber-400/90">
        AI-generated drafts are unreviewed. Faculty must review all clinical content — drug
        effects, vital-sign values, and timings — before use with learners.
      </p>
    </section>
  );
}
