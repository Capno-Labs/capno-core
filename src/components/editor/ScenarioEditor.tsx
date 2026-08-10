'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GeneratePanel } from '@/components/editor/GeneratePanel';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, enqueue, getPushedAt } from '@/lib/cloud/outbox';
import { downloadJson } from '@/lib/download';
import { lintScenario, type LintWarning } from '@/lib/engine/lint';
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
import { DraftPreviewCard } from './DraftPreviewCard';
import { EditorRail, type SectionIssueCounts } from './EditorRail';
import { JsonPanel } from './JsonPanel';
import { SECTIONS, sectionOfIssue, sectionOfPath, type SectionId, type SectionMeta } from './sections';
import { AssessmentSection } from './sections/AssessmentSection';
import { OverviewSection } from './sections/OverviewSection';
import { PatientSection } from './sections/PatientSection';
import { TeachingSection } from './sections/TeachingSection';
import { TimelineSection } from './sections/TimelineSection';
import { VitalsSection } from './sections/VitalsSection';

/**
 * Faculty case editor.
 *
 * The form is the primary authoring surface: the scenario document is split
 * into instructor-facing sections (Overview → Patient → Vitals → Timeline →
 * Assessment → Teaching) behind a navigation rail with per-section
 * validation badges, and the form covers the entire schema. Raw JSON is an
 * opt-in advanced surface (the toolbar's "Edit JSON" toggle) that *replaces*
 * the form while open — the two never edit the document at the same time,
 * and JSON text becomes the source of truth only after "Apply JSON",
 * validated with the same zod schema used at runtime.
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

const RAIL_IDS: SectionId[] = [...SECTIONS.map((s) => s.id), 'history'];

export function ScenarioEditor({ initial }: { initial?: Scenario }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>(initial ?? blankScenario());
  const [formDirty, setFormDirty] = useState(false);
  /** Pathless/transient errors (save failures, bad imports, cloud drops).
   *  Schema errors with a field path surface on their owning section instead. */
  const [errors, setErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<ScenarioVersion[]>([]);
  const [cloudState, setCloudState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  // Advanced JSON surface. Text is regenerated from the scenario each time
  // the panel opens, so the form never has to keep it in sync per keystroke.
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonDirty, setJsonDirty] = useState(false);

  // AI draft awaiting review, and the pre-load document for one-click undo.
  const [draft, setDraft] = useState<Scenario | null>(null);
  const [draftError, setDraftError] = useState<{ errors: string[]; rawText: string } | null>(null);
  const [undoScenario, setUndoScenario] = useState<Scenario | null>(null);

  // Unsaved content (form edits or unapplied JSON) → warn before leaving.
  useBeforeUnload(formDirty || jsonDirty);

  useEffect(() => {
    setHistory(getVersionHistory(scenario.id));
  }, [scenario.id, savedAt]);

  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  // Deep links / reloads restore the section from the URL hash.
  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if ((RAIL_IDS as string[]).includes(h)) setActiveSection(h as SectionId);
  }, []);

  const update = (patch: Partial<Scenario>) => {
    // Only reachable from the form surface — the JSON panel replaces it, so
    // the two can never race for the document.
    setScenario({ ...scenario, ...patch });
    setFormDirty(true);
    setErrors([]);
  };

  /** Wholesale document replacement (Apply JSON, import, restore, AI load). */
  const replaceScenario = (next: Scenario) => {
    setScenario(next);
    setFormDirty(true);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonDirty(false);
    setErrors([]);
  };

  const selectSection = (id: SectionId) => {
    if (jsonDirty) {
      toast('Apply or discard your JSON edits first', 'error');
      return;
    }
    setJsonOpen(false);
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  const toggleJson = () => {
    if (jsonOpen) {
      if (jsonDirty) {
        toast('Apply or discard your JSON edits first', 'error');
        return;
      }
      setJsonOpen(false);
    } else {
      setJsonText(JSON.stringify(scenario, null, 2));
      setJsonDirty(false);
      setJsonOpen(true);
    }
  };

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
      replaceScenario(parseScenario(raw));
    } catch (e) {
      setErrors([`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const save = () => {
    if (jsonDirty) {
      toast('Apply or discard your JSON edits before saving', 'error');
      return;
    }
    const check = validateScenario(scenario);
    if (!check.ok) {
      const sections = [
        ...new Set(check.errors.map(sectionOfIssue).filter((s): s is SectionId => s !== null)),
      ];
      if (sections.length > 0) {
        const labels = sections
          .map((id) => SECTIONS.find((s) => s.id === id)?.label ?? id)
          .join(', ');
        toast(`${check.errors.length} issue(s) to fix — see ${labels}`, 'error');
        selectSection(sections[0]);
      }
      setErrors(check.errors.filter((e) => sectionOfIssue(e) === null));
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
        replaceScenario(parsed);
        toast(`Imported “${parsed.title}”`, 'success');
      } catch (e) {
        setErrors([`Could not import: ${e instanceof Error ? e.message : String(e)}`]);
      }
    };
    reader.readAsText(file);
  };

  const restoreVersion = (v: ScenarioVersion) => {
    replaceScenario(v.scenario);
  };

  /**
   * AI drafts never land in the document directly: a validated draft shows a
   * preview card, and faculty explicitly load it (with one-click undo of the
   * replaced work). Invalid drafts open the JSON surface for manual repair —
   * a broken draft can't be represented in the form.
   */
  const handleGenerated = (result: GenerateResult) => {
    if (result.ok) {
      setDraft(result.scenario);
      setDraftError(null);
      toast('Draft ready — review the preview below', 'success');
    } else {
      setDraft(null);
      setDraftError({ errors: result.errors, rawText: result.rawText });
      toast('Draft failed validation — see errors', 'error');
    }
  };

  const loadDraft = () => {
    if (!draft) return;
    if (jsonDirty) {
      toast('Apply or discard your JSON edits first', 'error');
      return;
    }
    setUndoScenario(scenario);
    replaceScenario(draft);
    setDraft(null);
    setJsonOpen(false);
    toast('Draft loaded — review all clinical content, then Save', 'success');
  };

  const undoDraftLoad = () => {
    if (!undoScenario) return;
    replaceScenario(undoScenario);
    setUndoScenario(null);
  };

  const repairInJson = () => {
    if (!draftError) return;
    setJsonText(draftError.rawText);
    setJsonDirty(true);
    setJsonOpen(true);
    setErrors(draftError.errors);
    setDraftError(null);
  };

  const validation = useMemo(() => validateScenario(scenario), [scenario]);
  // Lint runs even while the scenario has validation errors: the editor's
  // state is always a structurally complete Scenario, and a half-built event
  // (e.g. a fresh preset with no id yet) is exactly when the nudges help.
  const warnings = useMemo(() => lintScenario(scenario), [scenario]);
  const aiDraft = scenario.tags.topics.includes(AI_GENERATED_TAG);

  // Route every pathful issue to its owning section; the rest stay global.
  const issues = useMemo(() => {
    const bySection = new Map<SectionId, { errors: string[]; warnings: LintWarning[] }>();
    const at = (id: SectionId) => {
      let entry = bySection.get(id);
      if (!entry) {
        entry = { errors: [], warnings: [] };
        bySection.set(id, entry);
      }
      return entry;
    };
    const globalErrors: string[] = [];
    const globalWarnings: LintWarning[] = [];
    for (const e of validation.errors) {
      const id = sectionOfIssue(e);
      if (id) at(id).errors.push(e);
      else globalErrors.push(e);
    }
    for (const w of warnings) {
      const id = sectionOfPath(w.path);
      if (id) at(id).warnings.push(w);
      else globalWarnings.push(w);
    }
    return { bySection, globalErrors, globalWarnings };
  }, [validation, warnings]);

  const issueCounts = useMemo(() => {
    const counts = new Map<SectionId, SectionIssueCounts>();
    for (const [id, entry] of issues.bySection) {
      counts.set(id, { errors: entry.errors.length, warnings: entry.warnings.length });
    }
    return counts;
  }, [issues]);

  const railSections: SectionMeta[] = [
    ...SECTIONS,
    { id: 'history', label: history.length > 0 ? `History (${history.length})` : 'History' },
  ];

  const activeIssues = issues.bySection.get(activeSection);
  const globalErrors = [...errors, ...issues.globalErrors];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection scenario={scenario} update={update} />;
      case 'patient':
        return <PatientSection scenario={scenario} update={update} />;
      case 'vitals':
        return <VitalsSection scenario={scenario} update={update} />;
      case 'timeline':
        return <TimelineSection scenario={scenario} update={update} warnings={warnings} />;
      case 'assessment':
        return <AssessmentSection scenario={scenario} update={update} />;
      case 'teaching':
        return <TeachingSection scenario={scenario} update={update} />;
      case 'history':
        return (
          <section className="card">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              Version history ({scenario.id})
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">
                No saved versions yet — “Save version” snapshots the case here.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
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
            )}
          </section>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — sticky so Save and issue counts stay visible on long sections. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-slate-950/95 py-2 backdrop-blur">
        <button
          className="btn-primary"
          onClick={save}
          disabled={jsonDirty}
          title={jsonDirty ? 'Apply or discard your JSON edits first' : undefined}
        >
          💾 Save version
        </button>
        <button
          className="btn-ghost"
          onClick={() => router.push(`/faculty/run/${scenario.id}`)}
          disabled={!validation.ok || jsonDirty}
          title={validation.ok ? 'Save first to run the latest edits' : 'Fix validation errors first'}
        >
          ▶ Test run
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
          className={jsonOpen ? 'btn-secondary' : 'btn-ghost'}
          aria-pressed={jsonOpen}
          onClick={toggleJson}
          title="Advanced: edit the full definition as raw JSON"
        >
          {'</>'} Edit JSON
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

      {draft && <DraftPreviewCard draft={draft} onLoad={loadDraft} onDiscard={() => setDraft(null)} />}

      {draftError && (
        <div className="space-y-2 rounded-md bg-red-950/60 p-3 text-sm text-red-300 ring-1 ring-red-800">
          <p className="font-semibold">The AI draft failed validation:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {draftError.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {draftError.rawText && (
              <button className="btn-secondary !py-1 text-xs" onClick={repairInJson}>
                Open in JSON editor to repair
              </button>
            )}
            <button className="btn-ghost !py-1 text-xs" onClick={() => setDraftError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {undoScenario && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-sky-950/50 p-3 text-sm text-sky-300 ring-1 ring-sky-800">
          <span className="flex-1">AI draft loaded — your previous work was replaced.</span>
          <button className="btn-secondary !py-1 text-xs" onClick={undoDraftLoad}>
            Undo
          </button>
          <button className="btn-ghost !py-1 text-xs" onClick={() => setUndoScenario(null)}>
            Keep draft
          </button>
        </div>
      )}

      {aiDraft && (
        <div className="rounded-md bg-amber-950/50 p-3 text-sm text-amber-300 ring-1 ring-amber-700">
          ⚠ AI-generated draft — requires faculty review of all clinical content (drug effects,
          vital values, timings) before use with learners. Remove the “{AI_GENERATED_TAG}” topic
          tag after review.
        </div>
      )}

      {globalErrors.length > 0 && (
        <div className="rounded-md bg-red-950/60 p-3 text-sm text-red-300 ring-1 ring-red-800">
          <ul className="list-disc space-y-0.5 pl-5">
            {globalErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {issues.globalWarnings.length > 0 && (
        <div className="rounded-md bg-amber-950/40 p-3 text-sm ring-1 ring-amber-900">
          <ul className="list-disc space-y-0.5 pl-5">
            {issues.globalWarnings.map((w, i) => (
              <li key={i} className={w.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}>
                <span className="font-mono text-xs">{w.path}</span>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="desk:flex desk:items-start desk:gap-5">
        <EditorRail
          sections={railSections}
          active={activeSection}
          issueCounts={issueCounts}
          onSelect={selectSection}
        />
        <div className="mt-3 min-w-0 flex-1 space-y-4 desk:mt-0">
          {jsonOpen ? (
            <JsonPanel
              text={jsonText}
              dirty={jsonDirty}
              onChange={(t) => {
                setJsonText(t);
                setJsonDirty(true);
              }}
              onApply={applyJson}
              onDiscard={discardJson}
            />
          ) : (
            <>
              {activeIssues && activeIssues.errors.length > 0 && (
                <div className="rounded-md bg-red-950/60 p-3 text-sm text-red-300 ring-1 ring-red-800">
                  <ul className="list-disc space-y-0.5 pl-5">
                    {activeIssues.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeIssues && activeIssues.warnings.length > 0 && (
                <div className="rounded-md bg-amber-950/40 p-3 text-sm ring-1 ring-amber-900">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Authoring warnings — saving is not blocked
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {activeIssues.warnings.map((w, i) => (
                      <li key={i} className={w.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}>
                        <span className="font-mono text-xs">{w.path}</span>: {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {renderSection()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
