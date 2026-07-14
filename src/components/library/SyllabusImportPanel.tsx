'use client';

import { useEffect, useRef, useState } from 'react';
import { DocumentInput } from '@/components/ui/DocumentInput';
import { cloudEligible, drain, enqueue } from '@/lib/cloud/outbox';
import { generateScenario, prepareDocument } from '@/lib/llm/generator';
import { getLlmProvider } from '@/lib/llm/settings';
import { extractSyllabusLabs, type SyllabusLab } from '@/lib/llm/syllabus';
import {
  BUILT_IN_SCENARIOS,
  QUICK_START_ID,
  addToCollection,
  createCollection,
  listCustomScenarios,
  saveCustomScenario,
  uniquifyId,
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

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!configured) return null;

  const setDocument = (text: string) => {
    const prepared = prepareDocument(text);
    setDocText(prepared.text);
    setDocTruncated(prepared.truncated);
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
    if (controller.signal.aborted) {
      // Back to the input step (document kept) — otherwise the panel is
      // stranded on a spinner with a dead Cancel button.
      setStep('input');
      return;
    }
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

    // Never shadow reviewed built-ins, the pinned quick-start, existing
    // custom scenarios, or an earlier draft of this run.
    const taken = new Set([
      ...BUILT_IN_SCENARIOS.map((s) => s.id),
      QUICK_START_ID,
      ...listCustomScenarios().map((s) => s.id),
    ]);
    // Created lazily on the first successful draft so a fully failed run
    // doesn't leave an empty collection behind.
    let collectionId: string | null = null;
    const fallbackTitle = collectionTitle.trim() || 'Syllabus drafts';
    const results: DraftOutcome[] = [];
    const pushOutcome = (o: DraftOutcome) => {
      results.push(o);
      setOutcomes([...results]);
    };

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
        pushOutcome({ title: lab.title, ok: false, error: result.errors[0] });
        continue;
      }
      const id = uniquifyId(result.scenario.id, taken);
      const saved = saveCustomScenario({ ...result.scenario, id });
      if (!saved.ok) {
        pushOutcome({ title: lab.title, ok: false, error: saved.error });
        toast(saved.error, 'error');
        break;
      }
      taken.add(id);
      if (cloudEligible()) enqueue('scenario', id);
      // The draft is saved either way — record it before the collection
      // write so a create failure can't mislabel the run as fully failed.
      pushOutcome({ title: lab.title, ok: true });
      if (!collectionId) {
        const created = createCollection(fallbackTitle);
        if (!created) {
          toast(
            'The draft was saved, but the collection could not be created — device storage may be full.',
            'error',
          );
          break;
        }
        collectionId = created.id;
      }
      const added = addToCollection(collectionId, id);
      if (!added.ok) toast(added.error, 'error');
      onChanged(); // drafts appear in the library as they land
    }

    setStep('done');
    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      toast(
        `Drafted ${okCount} of ${selected.length} scenario${selected.length === 1 ? '' : 's'} into “${fallbackTitle}” — review before use with learners`,
        'success',
      );
      if (cloudEligible()) void drain();
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

  const selectedCount = checked.filter(Boolean).length;

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
          <DocumentInput
            value={docText}
            truncated={docTruncated}
            onChange={setDocument}
            rows={8}
            placeholder="Paste your syllabus or lab schedule — each sim session it describes becomes a scenario draft…"
            ariaLabel="Syllabus document"
            onFileName={(name) => {
              if (!collectionTitle.trim()) {
                setCollectionTitle(name.replace(/\.(txt|md)$/i, '').trim());
              }
            }}
          />
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
              disabled={selectedCount === 0}
            >
              Draft {selectedCount} scenario{selectedCount === 1 ? '' : 's'}
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
