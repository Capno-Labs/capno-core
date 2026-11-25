'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GeneratePanel } from '@/components/editor/GeneratePanel';
import { useAuthStore } from '@/lib/cloud/authStore';
import {
  cloudEligible,
  drain,
  enqueue,
  getPushedAt,
  getSyncMeta,
  type CloudScenarioStatus,
} from '@/lib/cloud/outbox';
import { approveScenario, refreshScenarioStatus } from '@/lib/cloud/scenarioCloud';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { downloadJson } from '@/lib/download';
import { lintScenario, type LintWarning } from '@/lib/engine/lint';
import { validateScenario, parseScenario } from '@/lib/engine/schema';
import type { Scenario } from '@/lib/engine/types';
import { DEFAULT_VITALS } from '@/lib/engine/vitals';
import { AI_GENERATED_TAG, type GenerateResult } from '@/lib/llm/generator';
import { useLeaveGuard } from '@/lib/hooks/useBeforeUnload';
import { getScenario, listAllScenarios } from '@/lib/scenarios';
import {
  getVersionHistory,
  saveCustomScenario,
  type ScenarioVersion,
} from '@/lib/scenarios/customStore';
import { clearDraft, saveDraft } from '@/lib/scenarios/draftStore';
import {
  amendPresent,
  canRedo,
  canUndo,
  createHistory,
  pushEdit,
  redo as redoEdit,
  undo as undoEdit,
} from '@/lib/scenarios/editHistory';
import { NEW_SCENARIO_ID, scenarioIdFromTitle } from '@/lib/scenarios/scenarioId';
import { confirmDialog } from '@/lib/store/dialogStore';
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
 *
 * Three layers of "saved", in order of permanence:
 *  - undo history: this visit only (toolbar, Cmd/Ctrl+Z);
 *  - the working draft: every edit, written to this device a moment later
 *    (draftStore.ts) and restored on the next visit;
 *  - versions: "Save version" — what the library, sessions and the cloud see.
 */

/** Delay before an edit is written to the working draft. */
const DRAFT_DEBOUNCE_MS = 400;

export function blankScenario(): Scenario {
  return {
    id: NEW_SCENARIO_ID,
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

const STATUS_TONE: Record<CloudScenarioStatus, PillTone> = {
  draft: 'neutral',
  review: 'warn',
  published: 'green',
};

export interface ScenarioEditorProps {
  /** Document to open; omitted for a blank new case. */
  initial?: Scenario;
  /** Where this document's working draft is kept (draftStore.ts). */
  draftKey: string;
  /** The id this document is saved under; null until its first save. */
  savedId: string | null;
  /** Set when `initial` is a restored draft: when it was written, and what
   *  "Discard" goes back to (the saved case, or the template it started from). */
  restored?: { savedAtIso: string; baseline?: Scenario };
  /** The document was saved under `id` (first save, or a changed ID). */
  onSavedAs?: (id: string) => void;
}

export function ScenarioEditor({
  initial,
  draftKey: initialDraftKey,
  savedId: initialSavedId,
  restored,
  onSavedAs,
}: ScenarioEditorProps) {
  const router = useRouter();
  const [edits, setEdits] = useState(() => createHistory<Scenario>(initial ?? blankScenario()));
  const scenario = edits.present;
  /** Edits since the last saved version (a restored draft starts dirty). */
  const [formDirty, setFormDirty] = useState(Boolean(restored));
  const [savedId, setSavedId] = useState<string | null>(initialSavedId);
  const draftKey = useRef(initialDraftKey);
  /** False once a draft write has failed — then leaving really loses work. */
  const [draftStored, setDraftStored] = useState(true);
  const [restoredNotice, setRestoredNotice] = useState(restored ?? null);
  /** Pathless/transient errors (save failures, bad imports, cloud drops).
   *  Schema errors with a field path surface on their owning section instead. */
  const [errors, setErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<ScenarioVersion[]>([]);
  const [cloudState, setCloudState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  /** Review state of the cloud head (null: never synced or unknown). */
  const [cloudStatus, setCloudStatus] = useState<CloudScenarioStatus | null>(null);
  const [approving, setApproving] = useState(false);
  // Subscribed so the approve affordance appears/disappears with sign-in.
  const authStatus = useAuthStore((s) => s.status);
  const authRole = useAuthStore((s) => s.profile?.role);
  const canApprove = cloudEligible();
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

  // Form edits are safe in the working draft; only what is NOT in it needs a
  // warning before leaving: unapplied JSON text, or a draft that failed to store.
  useLeaveGuard(jsonDirty || (formDirty && !draftStored), {
    title: 'Leave without saving?',
    body: jsonDirty
      ? 'Your JSON edits have not been applied and will be lost.'
      : 'This device could not store your draft, so unsaved changes will be lost. Save a version or export the JSON first.',
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
    tone: 'danger',
  });

  // Working draft: written shortly after each edit, and at once when the
  // editor closes or the tab is hidden (iPads rarely fire unload).
  const pendingDraft = useRef<Scenario | null>(null);
  // A restored draft is already stored; rewriting it would only reset its time.
  const alreadyStored = useRef<Scenario | null>(restored ? scenario : null);
  const flushDraft = useCallback(() => {
    if (!pendingDraft.current) return;
    const ok = saveDraft(draftKey.current, pendingDraft.current);
    pendingDraft.current = null;
    setDraftStored(ok);
  }, []);
  useEffect(() => {
    if (!formDirty || scenario === alreadyStored.current) return;
    alreadyStored.current = null;
    pendingDraft.current = scenario;
    const timer = window.setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [scenario, formDirty, flushDraft]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushDraft();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushDraft);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  useEffect(() => {
    setHistory(savedId ? getVersionHistory(savedId) : []);
  }, [savedId, savedAt]);

  // Review state: what the last sync remembered, refreshed from the cloud for
  // saved scenarios when a faculty account is available (one small select;
  // nothing happens unconfigured or signed out).
  useEffect(() => {
    const id = scenario.id;
    setCloudStatus(getSyncMeta('scenario', id)?.cloudStatus ?? null);
    if (!cloudEligible() || !getPushedAt('scenario', id)) return;
    let cancelled = false;
    void refreshScenarioStatus(id).then((status) => {
      if (!cancelled && status) setCloudStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario.id, savedAt, authStatus, authRole]);

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
    const now = Date.now();
    setEdits((h) => pushEdit(h, { ...h.present, ...patch }, now));
    setFormDirty(true);
    setErrors([]);
  };

  /** Wholesale document replacement (Apply JSON, import, restore, AI load).
   *  Always its own undo step. */
  const replaceScenario = (next: Scenario) => {
    setEdits((h) => pushEdit(h, next, Date.now(), false));
    setFormDirty(true);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonDirty(false);
    setErrors([]);
  };

  const stepHistory = (step: typeof undoEdit) => {
    // The JSON surface has its own text undo; the form's history waits.
    if (jsonOpen) return;
    // Functional update: "Undo" buttons inside toasts call this from an
    // older render and must still act on the current history.
    setEdits((h) => step(h));
    setFormDirty(true);
    setErrors([]);
  };
  const undo = () => stepHistory(undoEdit);
  const redo = () => stepHistory(redoEdit);

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

  /** Saves a version. Resolves to the id it was saved under, or null. */
  const save = async (): Promise<string | null> => {
    if (jsonDirty) {
      toast('Apply or discard your JSON edits before saving', 'error');
      return null;
    }
    // A never-saved case gets its own id from its title, so two new cases can
    // never land on the same record.
    const doc: Scenario =
      savedId === null && scenario.id === NEW_SCENARIO_ID
        ? {
            ...scenario,
            id: scenarioIdFromTitle(scenario.title, new Set(listAllScenarios().map((s) => s.id))),
          }
        : scenario;
    const check = validateScenario(doc);
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
      return null;
    }
    // A hand-typed ID that belongs to another case would add this document to
    // that case's history — never do that silently.
    if (doc.id === scenario.id && doc.id !== savedId) {
      const other = getScenario(doc.id);
      if (other) {
        const ok = await confirmDialog({
          title: `Save over “${other.title}”?`,
          body: `The ID “${doc.id}” already belongs to that case. Saving here replaces it in your library with this one. To keep both, cancel and change the ID in Overview.`,
          confirmLabel: 'Save over it',
          tone: 'danger',
        });
        if (!ok) return null;
      }
    }
    const result = saveCustomScenario(doc);
    if (!result.ok) {
      setErrors([result.error]);
      return null;
    }
    if (doc.id !== scenario.id) {
      // Every undo step carries the new id too — undoing must never bring the
      // placeholder back and save the case under it.
      const withId = (sc: Scenario): Scenario => ({ ...sc, id: doc.id });
      setEdits((h) => ({
        ...amendPresent(h, withId(h.present)),
        past: h.past.map(withId),
        future: h.future.map(withId),
      }));
    }
    // The draft is now a version: drop it, and key later drafts by the id.
    pendingDraft.current = null;
    clearDraft(draftKey.current);
    draftKey.current = doc.id;
    setDraftStored(true);
    setRestoredNotice(null);
    if (doc.id !== savedId) {
      setSavedId(doc.id);
      onSavedAs?.(doc.id);
    }
    setSavedAt(new Date().toLocaleTimeString());
    setFormDirty(false);
    setErrors([]);
    toast('Version saved', 'success');
    // Cloud is additive: local save already succeeded, push in the background.
    if (cloudEligible()) {
      enqueue('scenario', doc.id);
      setCloudState('syncing');
      const id = doc.id;
      void drain().then((r) => {
        if (r.dropped.length > 0) setErrors((prev) => [...prev, ...r.dropped]);
        setCloudState(getPushedAt('scenario', id) ? 'synced' : 'failed');
        setCloudStatus(getSyncMeta('scenario', id)?.cloudStatus ?? null);
      });
    }
    return doc.id;
  };

  /** Test run always runs what is on screen: unsaved edits are saved first. */
  const testRun = async () => {
    const id = formDirty || savedId === null ? await save() : savedId;
    if (id) router.push(`/faculty/run/${id}`);
  };

  /** Throw away the restored draft and return to the saved case. */
  const discardRestored = () => {
    replaceScenario(restoredNotice?.baseline ?? blankScenario());
    pendingDraft.current = null;
    clearDraft(draftKey.current);
    setFormDirty(false);
    setRestoredNotice(null);
    toast('Unsaved changes discarded', 'info', { label: 'Undo', onClick: undo });
  };

  /**
   * Approve & publish: pushes the saved head and pins it as the approved
   * version. The database decides who may approve (42501 → permanent
   * failure with a plain-language message); the saved local copy is never
   * affected either way.
   */
  const approve = async () => {
    if (formDirty || jsonDirty) {
      toast('Save your changes before approving', 'error');
      return;
    }
    if (history.length === 0) {
      toast('Save a version first', 'error');
      return;
    }
    setApproving(true);
    try {
      const result = await approveScenario(scenario.id);
      if (result.ok) {
        setCloudStatus('published');
        setCloudState('synced');
        toast('Approved and published', 'success');
      } else {
        toast(result.permanent ? result.error : `Could not approve: ${result.error}`, 'error');
        setCloudStatus(getSyncMeta('scenario', scenario.id)?.cloudStatus ?? null);
      }
    } finally {
      setApproving(false);
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
    toast(`Restored the version from ${new Date(v.savedAtIso).toLocaleString()}`, 'info', {
      label: 'Undo',
      onClick: undo,
    });
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

  // Ctrl/⌘ S saves; Ctrl/⌘ Z and Shift+Z (or Ctrl Y) step the form's history.
  // Modifier combos, so they work while a field has focus; a modal keeps them.
  const keys = useRef({ save, undo, redo, jsonOpen, edits });
  keys.current = { save, undo, redo, jsonOpen, edits };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.repeat) return;
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void keys.current.save();
      } else if ((key === 'z' || key === 'y') && !keys.current.jsonOpen) {
        e.preventDefault();
        const forward = key === 'y' || e.shiftKey;
        if (forward && canRedo(keys.current.edits)) keys.current.redo();
        if (!forward && canUndo(keys.current.edits)) keys.current.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                Version history ({savedId ?? 'not saved yet'})
              </h2>
              {cloudStatus && (
                <Pill
                  tone={STATUS_TONE[cloudStatus]}
                  title="Review state of the institution copy of this scenario"
                >
                  {cloudStatus}
                </Pill>
              )}
              {canApprove && (
                <button
                  className="btn-primary ml-auto btn-sm"
                  disabled={approving || cloudStatus === 'published' || formDirty || jsonDirty}
                  title={
                    cloudStatus === 'published'
                      ? 'Already published — editing and saving starts a new draft'
                      : 'Publish the saved version to the institution library as the approved version'
                  }
                  onClick={() => void approve()}
                >
                  {approving ? 'Approving…' : 'Approve & publish'}
                </button>
              )}
            </div>
            {canApprove && (
              <p className="mb-2 text-xs text-faint">
                Sessions run against the approved version. Saving a new edit over a published
                scenario returns it to draft until it is approved again.
              </p>
            )}
            {history.length === 0 ? (
              <p className="text-sm text-faint">
                No saved versions yet — “Save version” snapshots the case here.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {history.map((v, i) => (
                  <li key={v.savedAtIso} className="flex items-center justify-between gap-2 rounded-ctl bg-panel-2 px-2 py-1">
                    <span>
                      {new Date(v.savedAtIso).toLocaleString()}{' '}
                      <span className="text-xs text-faint">v{v.scenario.version}{i === 0 ? ' · latest' : ''}</span>
                    </span>
                    {i > 0 && (
                      <button className="text-xs text-brand-strong hover:underline" onClick={() => restoreVersion(v)}>
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
      {/* Toolbar — sticky BELOW the shell's top bar (which is z-30), so Save
          and the issue counts stay visible on long sections. */}
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:-mx-7 md:px-7">
        <button
          className="btn-primary"
          onClick={() => void save()}
          disabled={jsonDirty}
          title={jsonDirty ? 'Apply or discard your JSON edits first' : undefined}
        >
          <Icon name="save" size={16} /> Save version
        </button>
        <button
          className="btn-ghost"
          onClick={() => void testRun()}
          disabled={!validation.ok || jsonDirty}
          title={
            !validation.ok
              ? 'Fix validation errors first'
              : formDirty || savedId === null
                ? 'Saves a version, then opens the run screen'
                : 'Opens the run screen with this case'
          }
        >
          <Icon name="play" size={16} /> Test run
        </button>
        <span className="flex items-center">
          <button
            className="btn-ghost btn-icon"
            onClick={undo}
            disabled={jsonOpen || !canUndo(edits)}
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
          >
            <Icon name="undo" size={16} />
          </button>
          <button
            className="btn-ghost btn-icon"
            onClick={redo}
            disabled={jsonOpen || !canRedo(edits)}
            aria-label="Redo"
            title="Redo (Ctrl/⌘ Shift Z)"
          >
            <Icon name="redo" size={16} />
          </button>
        </span>
        <button className="btn-secondary" onClick={exportFile}>
          <Icon name="download" size={16} /> Export JSON
        </button>
        <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={16} /> Import JSON
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
          <Icon name="code" size={16} /> Edit JSON
        </button>
        {formDirty && (
          <span className={`text-xs ${draftStored ? 'text-muted' : 'text-warn-strong'}`} data-draft-status>
            {draftStored
              ? 'Unsaved changes — kept as a draft on this device'
              : 'Unsaved changes — this device could not store a draft'}
          </span>
        )}
        {!formDirty && savedAt && (
          <span className="text-xs text-green">
            Saved {savedAt}
            {cloudState === 'syncing' && <span className="text-muted"> · syncing…</span>}
            {cloudState === 'synced' && <span className="text-brand-strong"> · synced to cloud</span>}
            {cloudState === 'failed' && (
              <span className="text-warn-strong"> · cloud sync pending (will retry)</span>
            )}
          </span>
        )}
        {!validation.ok && (
          <span className="text-xs text-warn-strong">{validation.errors.length} validation issue(s)</span>
        )}
        {validation.ok && warnings.length > 0 && (
          <span className="text-xs text-warn-strong">
            {warnings.length} authoring warning{warnings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {restoredNotice && (
        <Callout
          tone="info"
          title={`Picked up your unsaved changes from ${new Date(restoredNotice.savedAtIso).toLocaleString()}.`}
          actions={
            <>
              <button className="btn-secondary btn-sm" onClick={discardRestored}>
                Discard them
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setRestoredNotice(null)}>
                Keep editing
              </button>
            </>
          }
        >
          They are not in the library until you save a version.
        </Callout>
      )}

      <GeneratePanel onResult={handleGenerated} />

      {draft && <DraftPreviewCard draft={draft} onLoad={loadDraft} onDiscard={() => setDraft(null)} />}

      {draftError && (
        <div className="space-y-2 rounded-ctl bg-red-soft p-3 text-sm text-red ring-1 ring-red/40">
          <p className="font-semibold">The AI draft failed validation:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {draftError.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {draftError.rawText && (
              <button className="btn-secondary btn-sm" onClick={repairInJson}>
                Open in JSON editor to repair
              </button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => setDraftError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {undoScenario && (
        <Callout
          tone="info"
          title="AI draft loaded — your previous work was replaced."
          actions={
            <>
              <button className="btn-secondary btn-sm" onClick={undoDraftLoad}>
                Undo
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setUndoScenario(null)}>
                Keep draft
              </button>
            </>
          }
        />
      )}

      {aiDraft && (
        <Callout tone="warn" title="AI-generated draft">
          Requires faculty review of all clinical content (drug effects, vital values, timings)
          before use with learners. Remove the “{AI_GENERATED_TAG}” topic tag after review.
        </Callout>
      )}

      {globalErrors.length > 0 && (
        <div className="rounded-ctl bg-red-soft p-3 text-sm text-red ring-1 ring-red/40">
          <ul className="list-disc space-y-0.5 pl-5">
            {globalErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {issues.globalWarnings.length > 0 && (
        <div className="rounded-ctl bg-warn-soft p-3 text-sm ring-1 ring-warn/40">
          <ul className="list-disc space-y-0.5 pl-5">
            {issues.globalWarnings.map((w, i) => (
              <li key={i} className={w.severity === 'warning' ? 'text-warn-strong' : 'text-muted'}>
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
                <div className="rounded-ctl bg-red-soft p-3 text-sm text-red ring-1 ring-red/40">
                  <ul className="list-disc space-y-0.5 pl-5">
                    {activeIssues.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeIssues && activeIssues.warnings.length > 0 && (
                <div className="rounded-ctl bg-warn-soft p-3 text-sm ring-1 ring-warn/40">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-warn-strong">
                    Authoring warnings — saving is not blocked
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {activeIssues.warnings.map((w, i) => (
                      <li key={i} className={w.severity === 'warning' ? 'text-warn-strong' : 'text-muted'}>
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
