'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GeneratePanel } from '@/components/editor/GeneratePanel';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, enqueue, getPushedAt } from '@/lib/cloud/outbox';
import { downloadJson } from '@/lib/download';
import { lintScenario } from '@/lib/engine/lint';
import { validateScenario, parseScenario } from '@/lib/engine/schema';
import type { Scenario } from '@/lib/engine/types';
import { DEFAULT_VITALS } from '@/lib/engine/vitals';
import { AI_GENERATED_TAG, type GenerateResult } from '@/lib/llm/generator';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import {
  getVersionHistory,
  saveCustomScenario,
  type ScenarioVersion,
} from '@/lib/scenarios/customStore';
import { toast } from '@/lib/store/toastStore';
import { ActionListEditor } from './ActionListEditor';
import { EventListEditor } from './EventListEditor';
import { PhaseListEditor } from './PhaseListEditor';
import { RubricEditor } from './RubricEditor';

/**
 * Faculty scenario editor.
 *
 * Hybrid model: the common fields (title, tags, patient, baseline vitals,
 * objectives…) are edited with forms; the full document — including events,
 * expected actions, and rubric — is always visible and editable in the JSON
 * pane, validated with the same zod schema used at runtime. This gives
 * non-technical faculty a form for the 90% case without us re-implementing a
 * schema-complete visual editor in the MVP.
 */

function blankScenario(): Scenario {
  return {
    id: 'my-new-scenario',
    version: '1.0.0',
    title: 'New scenario',
    summary: 'Describe the scenario in one or two sentences.',
    tags: { topics: ['general'], difficulty: 'beginner', trainingLevels: ['resident_junior'] },
    learningObjectives: ['State the first learning objective.'],
    setup: ['Standard OR setup with anesthesia machine and monitor.'],
    patient: {
      name: 'Alex Doe',
      age: 45,
      sex: 'male',
      weightKg: 80,
      heightCm: 175,
      asa: 2,
      allergies: [],
      medications: [],
      pmh: [],
      airway: { mallampati: 1 },
    },
    baselineVitals: { ...DEFAULT_VITALS },
    phases: [{ id: 'main', label: 'Main phase' }],
    events: [],
    expectedActions: [
      { id: 'example-action', label: 'Example expected action', critical: false, points: 10 },
    ],
    expectedProgression: [],
    correctManagement: [],
    commonErrors: [],
    debrief: { points: [], questions: [] },
    rubric: [{ id: 'management', label: 'Management', actionIds: ['example-action'] }],
    estimatedMinutes: 15,
  };
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <span className="label">{label}</span>
      <ul className="mb-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 rounded bg-slate-800/60 px-2 py-1 text-sm">
            <span className="flex-1">{item}</span>
            <button
              className="text-slate-500 hover:text-red-400"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`remove ${item}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          placeholder={placeholder ?? 'Add item…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              onChange([...items, draft.trim()]);
              setDraft('');
            }
          }}
        />
        <button
          className="btn-secondary shrink-0"
          onClick={() => {
            if (draft.trim()) {
              onChange([...items, draft.trim()]);
              setDraft('');
            }
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ScenarioEditor({ initial }: { initial?: Scenario }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>(initial ?? blankScenario());
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initial ?? blankScenario(), null, 2));
  const [jsonDirty, setJsonDirty] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<ScenarioVersion[]>([]);
  const [cloudState, setCloudState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Unsaved content (form edits or unapplied JSON) → warn before leaving.
  useBeforeUnload(formDirty || jsonDirty);

  useEffect(() => {
    setHistory(getVersionHistory(scenario.id));
  }, [scenario.id, savedAt]);

  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  /** Form edits flow into both the object and the JSON pane. */
  const update = (patch: Partial<Scenario>) => {
    if (jsonDirty) return; // the form is paused — unapplied JSON edits win
    const next = { ...scenario, ...patch };
    setScenario(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonDirty(false);
    setFormDirty(true);
    setErrors([]);
  };
  const updatePatient = (patch: Partial<Scenario['patient']>) =>
    update({ patient: { ...scenario.patient, ...patch } });

  const discardJson = () => {
    setJsonText(JSON.stringify(scenario, null, 2));
    setJsonDirty(false);
    setErrors([]);
  };

  const applyJson = () => {
    try {
      const raw = JSON.parse(jsonText);
      const check = validateScenario(raw);
      if (!check.ok) {
        setErrors(check.errors);
        return;
      }
      setScenario(parseScenario(raw));
      setJsonDirty(false);
      setFormDirty(true);
      setErrors([]);
    } catch (e) {
      setErrors([`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const save = () => {
    if (jsonDirty) {
      setErrors(['Apply or discard your JSON edits before saving.']);
      return;
    }
    const check = validateScenario(scenario);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    const result = saveCustomScenario(scenario);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setSavedAt(new Date().toLocaleTimeString());
    setFormDirty(false);
    setErrors([]);
    toast('Version saved', 'success');
    // Cloud is additive: local save already succeeded, push in the background.
    if (cloudEligible()) {
      enqueue('scenario', scenario.id);
      setCloudState('syncing');
      const id = scenario.id;
      void drain().then((r) => {
        if (r.dropped.length > 0) setErrors((prev) => [...prev, ...r.dropped]);
        setCloudState(getPushedAt('scenario', id) ? 'synced' : 'failed');
      });
    }
  };

  const exportFile = () => downloadJson(`${scenario.id}.json`, JSON.stringify(scenario, null, 2));

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const check = validateScenario(raw);
        if (!check.ok) {
          setErrors(check.errors);
          return;
        }
        const parsed = parseScenario(raw);
        setScenario(parsed);
        setJsonText(JSON.stringify(parsed, null, 2));
        setJsonDirty(false);
        setFormDirty(true);
        setErrors([]);
        toast(`Imported “${parsed.title}”`, 'success');
      } catch (e) {
        setErrors([`Could not import: ${e instanceof Error ? e.message : String(e)}`]);
      }
    };
    reader.readAsText(file);
  };

  const restoreVersion = (v: ScenarioVersion) => {
    setScenario(v.scenario);
    setJsonText(JSON.stringify(v.scenario, null, 2));
    setJsonDirty(false);
    setFormDirty(true);
    setErrors([]);
  };

  /**
   * AI drafts land in the JSON pane as *unapplied* text — the JSON pane is
   * only the source of truth after Apply JSON, so the draft always passes
   * through the existing validate → review → save pipeline.
   */
  const handleGenerated = (result: GenerateResult) => {
    if (result.ok) {
      setJsonText(JSON.stringify(result.scenario, null, 2));
      setJsonDirty(true);
      setErrors([]);
      toast('Draft generated — review it, then Apply JSON', 'success');
    } else {
      setJsonText(result.rawText || jsonText);
      setJsonDirty(Boolean(result.rawText));
      setErrors(result.errors);
      toast('Draft failed validation — see errors', 'error');
    }
  };

  const validation = useMemo(() => validateScenario(scenario), [scenario]);
  // Lint runs even while the scenario has validation errors: the editor's
  // state is always a structurally complete Scenario, and a half-built event
  // (e.g. a fresh preset with no id yet) is exactly when the nudges help.
  const warnings = useMemo(() => lintScenario(scenario), [scenario]);
  const aiDraft = scenario.tags.topics.includes(AI_GENERATED_TAG);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          onClick={save}
          disabled={jsonDirty}
          title={jsonDirty ? 'Apply or discard your JSON edits first' : undefined}
        >
          💾 Save version
        </button>
        <button className="btn-secondary" onClick={exportFile}>
          ⬇ Export JSON
        </button>
        <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
          ⬆ Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn-ghost"
          onClick={() => router.push(`/faculty/run/${scenario.id}`)}
          disabled={!validation.ok || jsonDirty}
          title={validation.ok ? 'Save first to run the latest edits' : 'Fix validation errors first'}
        >
          ▶ Test run
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-400">
            Saved {savedAt}
            {cloudState === 'syncing' && <span className="text-slate-400"> · syncing…</span>}
            {cloudState === 'synced' && <span className="text-sky-400"> · synced to cloud</span>}
            {cloudState === 'failed' && (
              <span className="text-amber-400"> · cloud sync pending (will retry)</span>
            )}
          </span>
        )}
        {!validation.ok && (
          <span className="text-xs text-amber-400">{validation.errors.length} validation issue(s)</span>
        )}
        {validation.ok && warnings.length > 0 && (
          <span className="text-xs text-amber-400/80">
            {warnings.length} authoring warning{warnings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <GeneratePanel onResult={handleGenerated} />

      {aiDraft && (
        <div className="rounded-md bg-amber-950/50 p-3 text-sm text-amber-300 ring-1 ring-amber-700">
          ⚠ AI-generated draft — requires faculty review of all clinical content (drug effects,
          vital values, timings) before use with learners. Remove the “{AI_GENERATED_TAG}” topic
          tag after review.
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-md bg-red-950/60 p-3 text-sm text-red-300 ring-1 ring-red-800">
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md bg-amber-950/40 p-3 text-sm ring-1 ring-amber-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
            Authoring warnings — saving is not blocked
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w, i) => (
              <li key={i} className={w.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}>
                <span className="font-mono text-xs">{w.path}</span>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Form pane ── */}
        <div className="space-y-4">
          {jsonDirty && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-950/60 p-3 text-sm text-amber-300 ring-1 ring-amber-800">
              <span className="flex-1">
                The JSON pane has unapplied edits. The form is paused so it can’t overwrite them.
              </span>
              <button className="btn-primary !py-1 text-xs" onClick={applyJson}>
                Apply JSON
              </button>
              <button className="btn-ghost !py-1 text-xs" onClick={discardJson}>
                Discard
              </button>
            </div>
          )}
          <div
            className={jsonDirty ? 'space-y-4 pointer-events-none select-none opacity-60' : 'space-y-4'}
            aria-disabled={jsonDirty}
          >
          <section className="card space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Basics</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">ID (kebab-case)</span>
                <input className="input font-mono" value={scenario.id} onChange={(e) => update({ id: e.target.value })} />
              </div>
              <div>
                <span className="label">Version</span>
                <input className="input font-mono" value={scenario.version} onChange={(e) => update({ version: e.target.value })} />
              </div>
            </div>
            <div>
              <span className="label">Title</span>
              <input className="input" value={scenario.title} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div>
              <span className="label">Summary</span>
              <textarea className="input" rows={2} value={scenario.summary} onChange={(e) => update({ summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">Difficulty</span>
                <select
                  className="input"
                  value={scenario.tags.difficulty}
                  onChange={(e) =>
                    update({ tags: { ...scenario.tags, difficulty: e.target.value as Scenario['tags']['difficulty'] } })
                  }
                >
                  <option value="beginner">beginner</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                </select>
              </div>
              <div>
                <span className="label">Est. minutes</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={scenario.estimatedMinutes}
                  onChange={(e) => update({ estimatedMinutes: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <span className="label" title="Hard time budget for a scheduled lab slot — the run screen counts down against it. Blank = use est. minutes.">
                  Slot budget (min)
                </span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="optional"
                  value={scenario.targetDurationSec !== undefined ? scenario.targetDurationSec / 60 : ''}
                  onChange={(e) => {
                    // Fractional minutes are fine; non-positive means "no
                    // budget", never a silent clamp (see PhaseListEditor).
                    const n = Number(e.target.value);
                    update({
                      targetDurationSec:
                        e.target.value === '' || !(n > 0)
                          ? undefined
                          : Math.max(1, Math.round(n * 60)),
                    });
                  }}
                />
              </div>
            </div>
            <ListEditor
              label="Topics"
              items={scenario.tags.topics}
              onChange={(topics) => update({ tags: { ...scenario.tags, topics } })}
              placeholder="e.g. airway, hemodynamics…"
            />
          </section>

          <section className="card space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Patient</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <span className="label">Name</span>
                <input className="input" value={scenario.patient.name} onChange={(e) => updatePatient({ name: e.target.value })} />
              </div>
              <div>
                <span className="label">Age</span>
                <input className="input" type="number" value={scenario.patient.age} onChange={(e) => updatePatient({ age: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <span className="label">Sex</span>
                <select className="input" value={scenario.patient.sex} onChange={(e) => updatePatient({ sex: e.target.value as 'male' | 'female' })}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </div>
              <div>
                <span className="label">Weight kg</span>
                <input className="input" type="number" value={scenario.patient.weightKg} onChange={(e) => updatePatient({ weightKg: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <span className="label">Height cm</span>
                <input className="input" type="number" value={scenario.patient.heightCm} onChange={(e) => updatePatient({ heightCm: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <span className="label">ASA</span>
                <select className="input" value={scenario.patient.asa} onChange={(e) => updatePatient({ asa: Number(e.target.value) as Scenario['patient']['asa'] })}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Mallampati</span>
                <select
                  className="input"
                  value={scenario.patient.airway.mallampati}
                  onChange={(e) =>
                    updatePatient({ airway: { ...scenario.patient.airway, mallampati: Number(e.target.value) as 1 | 2 | 3 | 4 } })
                  }
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ListEditor label="Allergies" items={scenario.patient.allergies} onChange={(allergies) => updatePatient({ allergies })} />
            <ListEditor label="Medications" items={scenario.patient.medications} onChange={(medications) => updatePatient({ medications })} />
            <ListEditor label="Past medical history" items={scenario.patient.pmh} onChange={(pmh) => updatePatient({ pmh })} />
          </section>

          <section className="card space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Teaching content</h2>
            <ListEditor label="Learning objectives" items={scenario.learningObjectives} onChange={(learningObjectives) => update({ learningObjectives })} />
            <ListEditor label="Setup" items={scenario.setup} onChange={(setup) => update({ setup })} />
            <ListEditor label="Expected progression" items={scenario.expectedProgression} onChange={(expectedProgression) => update({ expectedProgression })} />
            <ListEditor label="Correct management" items={scenario.correctManagement} onChange={(correctManagement) => update({ correctManagement })} />
            <ListEditor label="Common errors" items={scenario.commonErrors} onChange={(commonErrors) => update({ commonErrors })} />
            <ListEditor label="Debrief points" items={scenario.debrief.points} onChange={(points) => update({ debrief: { ...scenario.debrief, points } })} />
            <ListEditor label="Debrief questions" items={scenario.debrief.questions} onChange={(questions) => update({ debrief: { ...scenario.debrief, questions } })} />
          </section>

          <details className="card">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-slate-400">
              Phases ({scenario.phases.length})
            </summary>
            <div className="mt-3">
              <PhaseListEditor phases={scenario.phases} onChange={(phases) => update({ phases })} />
            </div>
          </details>

          <details className="card">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-slate-400">
              Events ({scenario.events.length})
            </summary>
            <div className="mt-3">
              <EventListEditor
                events={scenario.events}
                phases={scenario.phases}
                actions={scenario.expectedActions}
                baselineVitals={scenario.baselineVitals}
                estimatedMinutes={scenario.estimatedMinutes}
                warnings={warnings}
                onChange={(events) => update({ events })}
              />
            </div>
          </details>

          <details className="card">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-slate-400">
              Expected actions ({scenario.expectedActions.length})
            </summary>
            <div className="mt-3">
              <ActionListEditor
                actions={scenario.expectedActions}
                phases={scenario.phases}
                rubric={scenario.rubric}
                events={scenario.events}
                onChange={(expectedActions) => update({ expectedActions })}
              />
            </div>
          </details>

          <details className="card">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-slate-400">
              Rubric ({scenario.rubric.length} categories)
            </summary>
            <div className="mt-3">
              <RubricEditor
                rubric={scenario.rubric}
                actions={scenario.expectedActions}
                onChange={(rubric) => update({ rubric })}
              />
            </div>
          </details>

          {history.length > 0 && (
            <section className="card">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                Version history ({scenario.id})
              </h2>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {history.map((v, i) => (
                  <li key={v.savedAtIso} className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2 py-1">
                    <span>
                      {new Date(v.savedAtIso).toLocaleString()}{' '}
                      <span className="text-xs text-slate-500">v{v.scenario.version}{i === 0 ? ' · latest' : ''}</span>
                    </span>
                    {i > 0 && (
                      <button className="text-xs text-sky-400 hover:text-sky-300" onClick={() => restoreVersion(v)}>
                        restore
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>
        </div>

        {/* ── JSON pane ── */}
        <section className="card flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Full definition (JSON)
            </h2>
            {jsonDirty ? (
              <div className="flex gap-2">
                <button className="btn-primary !py-1 text-xs" onClick={applyJson}>
                  Apply JSON
                </button>
                <button className="btn-ghost !py-1 text-xs" onClick={discardJson}>
                  Discard
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                full document — power users can edit JSON directly
              </span>
            )}
          </div>
          <textarea
            className="input min-h-[600px] flex-1 font-mono text-xs leading-relaxed"
            spellCheck={false}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonDirty(true);
            }}
            aria-label="Scenario JSON"
          />
        </section>
      </div>
    </div>
  );
}
