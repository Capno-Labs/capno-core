'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { CollectionSection } from '@/components/library/CollectionSection';
import { SyllabusImportPanel } from '@/components/library/SyllabusImportPanel';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, enqueue, getPushedAt, isQueued } from '@/lib/cloud/outbox';
import { mergeCloudScenarios, pullScenarios } from '@/lib/cloud/scenarioCloud';
import { downloadJson } from '@/lib/download';
import { DOMAINS, domainOf } from '@/lib/engine/lint';
import { parseScenario, validateScenario } from '@/lib/engine/schema';
import type { Difficulty, Scenario, TrainingLevel } from '@/lib/engine/types';
import { TRAINING_LEVEL_LABELS } from '@/lib/engine/types';
import { AI_GENERATED_TAG } from '@/lib/llm/generator';
import {
  BUILT_IN_SCENARIOS,
  QUICK_START_ID,
  QUICK_START_SCENARIO,
  type ScenarioCollection,
  addToCollection,
  createCollection,
  deleteCollection,
  deleteCustomScenario,
  listAllScenarios,
  listCollections,
  listCustomScenarios,
  looksLikeCollectionBundle,
  parseCollectionBundle,
  planBundleImport,
  removeFromCollection,
  resolveRefs,
  renameCollection,
  saveCollection,
  saveCustomScenario,
  serializeCollectionBundle,
  swapInCollection,
} from '@/lib/scenarios';
import { toast } from '@/lib/store/toastStore';

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  beginner: 'bg-emerald-900/60 text-emerald-300',
  intermediate: 'bg-amber-900/60 text-amber-300',
  advanced: 'bg-red-900/60 text-red-300',
};

/** Section id for scenarios without a curriculum-domain tag. */
const CUSTOM_SECTION = 'Custom & drafts';

const SOURCE_OPTIONS = ['built-in', 'custom', 'cloud', 'ai draft'] as const;
type SourceFilter = (typeof SOURCE_OPTIONS)[number];

/** Scenario library: collections, browse, filter by tags, run, edit, export. */
export default function ScenarioLibraryPage() {
  // Custom scenarios and collections come from localStorage, so resolve
  // after mount.
  const [scenarios, setScenarios] = useState<Scenario[]>(BUILT_IN_SCENARIOS);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [collections, setCollections] = useState<ScenarioCollection[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<string>('all');
  const [trainingLevel, setTrainingLevel] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  // Scenario waiting to be added when "New collection…" was picked on a card.
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const authStatus = useAuthStore((s) => s.status);
  const authRole = useAuthStore((s) => s.profile?.role);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = () => {
    setScenarios(listAllScenarios());
    setCustomIds(new Set(listCustomScenarios().map((s) => s.id)));
    setCollections(listCollections());
  };

  useEffect(() => {
    refresh();
    useAuthStore.getState().init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cloud pull-on-view: render instantly from local data, then merge in
  // institutional scenarios once a faculty account is available.
  useEffect(() => {
    if (!cloudEligible()) return;
    let cancelled = false;
    void drain();
    void pullScenarios().then((pulled) => {
      if (cancelled) return;
      mergeCloudScenarios(pulled);
      setScenarios(listAllScenarios());
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus, authRole]);

  const builtInIds = useMemo(() => new Set(BUILT_IN_SCENARIOS.map((s) => s.id)), []);

  const importScenarioFile = (raw: unknown) => {
    const check = validateScenario(raw);
    if (!check.ok) {
      toast(`Import failed: ${check.errors[0]}`, 'error');
      return;
    }
    const parsed = parseScenario(raw);
    const saved = saveCustomScenario(parsed);
    if (!saved.ok) {
      toast(`Import failed: ${saved.error}`, 'error');
      return;
    }
    if (cloudEligible()) {
      enqueue('scenario', parsed.id);
      void drain();
    }
    refresh();
    toast(`Imported “${parsed.title}”`, 'success');
  };

  const importBundleFile = (raw: unknown) => {
    const result = parseCollectionBundle(raw);
    if (!result.ok) {
      toast(`Import failed: ${result.errors[0]}`, 'error');
      return;
    }
    const plan = planBundleImport(result.bundle, {
      builtInIds,
      customById: new Map(listCustomScenarios().map((s) => [s.id, s])),
      existingCollectionIds: new Set(listCollections().map((c) => c.id)),
    });
    for (const scenario of plan.scenariosToSave) {
      const saved = saveCustomScenario(scenario);
      if (!saved.ok) {
        // Abort before saving the collection — a half-imported bundle would
        // render as a collection full of missing refs.
        toast(`Import stopped at “${scenario.title}”: ${saved.error}`, 'error');
        refresh();
        return;
      }
      // Imported scenarios sync like editor saves for signed-in faculty.
      if (cloudEligible()) enqueue('scenario', scenario.id);
    }
    if (cloudEligible() && plan.scenariosToSave.length > 0) void drain();
    const saved = saveCollection(plan.collection);
    if (!saved.ok) {
      toast(saved.error, 'error');
      refresh();
      return;
    }
    refresh();
    const counts = [
      plan.newScenarioIds.length > 0 && `${plan.newScenarioIds.length} new`,
      plan.updatedScenarioIds.length > 0 && `${plan.updatedScenarioIds.length} updated`,
      plan.skippedIdenticalIds.length > 0 && `${plan.skippedIdenticalIds.length} unchanged`,
      plan.missingRefs.length > 0 && `${plan.missingRefs.length} missing`,
    ]
      .filter(Boolean)
      .join(', ');
    toast(
      `Imported collection “${plan.collection.title}”${
        plan.collectionIdRemapped ? ` (as “${plan.collection.id}”)` : ''
      }${counts ? ` — ${counts}` : ''}`,
      'success',
    );
  };

  // One import button for both file kinds: collection bundles carry a `kind`
  // discriminator; plain scenario files have no such key.
  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(String(reader.result));
        if (looksLikeCollectionBundle(raw)) importBundleFile(raw);
        else importScenarioFile(raw);
      } catch (e) {
        toast(`Import failed: ${e instanceof Error ? e.message : 'invalid JSON'}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const exportCollection = (c: ScenarioCollection) => {
    const customById = new Map(listCustomScenarios().map((s) => [s.id, s]));
    downloadJson(`${c.id}.collection.json`, serializeCollectionBundle(c, customById));
  };

  /** Toast a store write failure (storage full) instead of swallowing it. */
  const surface = (result: { ok: true } | { ok: false; error: string }) => {
    if (!result.ok) toast(result.error, 'error');
  };

  const handleCreateCollection = () => {
    const title = newTitle.trim();
    if (!title) return;
    const created = createCollection(title);
    if (!created) {
      toast('Could not save the collection — device storage may be full.', 'error');
      return;
    }
    if (pendingAddId) {
      const added = addToCollection(created.id, pendingAddId);
      if (!added.ok) toast(added.error, 'error');
    }
    setPendingAddId(null);
    setNewTitle('');
    setCreateOpen(false);
    refresh();
    toast(`Created collection “${created.title}”`, 'success');
  };

  const cloudBadge = (s: Scenario): { label: string; className: string } | null => {
    if (builtInIds.has(s.id)) return null; // bundled — always available, never synced
    if (authStatus !== 'signed_in') return null;
    if (isQueued('scenario', s.id))
      return { label: 'sync pending', className: 'bg-amber-900/60 text-amber-300' };
    if (getPushedAt('scenario', s.id))
      return { label: 'cloud', className: 'bg-sky-900/60 text-sky-300' };
    return { label: 'local only', className: 'bg-slate-800 text-slate-400' };
  };

  const matchesSource = (s: Scenario, wanted: SourceFilter): boolean => {
    switch (wanted) {
      case 'built-in':
        return builtInIds.has(s.id) && !customIds.has(s.id);
      case 'custom':
        return customIds.has(s.id);
      case 'cloud':
        return Boolean(getPushedAt('scenario', s.id));
      case 'ai draft':
        return s.tags.topics.includes(AI_GENERATED_TAG);
    }
  };

  const toggleDomain = (d: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const matchesFilters = (s: Scenario) =>
    (selectedDomains.size === 0 ||
      (() => {
        const d = domainOf(s);
        return d !== undefined && selectedDomains.has(d);
      })()) &&
    (difficulty === 'all' || s.tags.difficulty === difficulty) &&
    (trainingLevel === 'all' || s.tags.trainingLevels.includes(trainingLevel as TrainingLevel)) &&
    (source === 'all' || matchesSource(s, source as SourceFilter)) &&
    (q === '' || `${s.title} ${s.summary} ${s.tags.topics.join(' ')}`.toLowerCase().includes(q));
  const filtered = scenarios.filter(matchesFilters);

  const filtersActive =
    selectedDomains.size > 0 || difficulty !== 'all' || trainingLevel !== 'all' || source !== 'all';

  // Collections resolve by id against everything visible on this device
  // (imported bundles may also reference the pinned quick-start scenario).
  const scenarioById = useMemo(() => {
    const byId = new Map(scenarios.map((s) => [s.id, s]));
    if (!byId.has(QUICK_START_ID)) byId.set(QUICK_START_ID, QUICK_START_SCENARIO);
    return byId;
  }, [scenarios]);

  // Collection sections: resolved in stored order, filtered like everything
  // else. While filtering, empty collections hide like empty domain sections;
  // unfiltered they stay visible so cases can be added. Searching hides them
  // entirely (search flattens to one list).
  const collectionSections =
    q === ''
      ? collections
          .map((c) => {
            const refs = resolveRefs(c.scenarioIds, (id) => scenarioById.has(id));
            return {
              collection: c,
              items: refs.present
                .map((id) => scenarioById.get(id))
                .filter((s): s is Scenario => Boolean(s))
                .filter(matchesFilters),
              missingIds: filtersActive ? [] : refs.missing,
            };
          })
          .filter(({ items }) => !filtersActive || items.length > 0)
      : [];
  const anyCollectionItemVisible = collectionSections.some(({ items }) => items.length > 0);

  // Grouped by curriculum domain while browsing; searching flattens so no
  // match hides below the fold. Scenarios without a domain tag are never
  // hidden — they get their own section.
  const bySlug = (a: Scenario, b: Scenario) =>
    (a.tags.topics[1] ?? a.id).localeCompare(b.tags.topics[1] ?? b.id);
  const sections: Array<{ title: string; items: Scenario[] }> = [];
  if (q === '') {
    for (const d of DOMAINS) {
      const items = filtered.filter((s) => domainOf(s) === d).sort(bySlug);
      if (items.length > 0) sections.push({ title: d, items });
    }
    const unclassified = filtered.filter((s) => domainOf(s) === undefined);
    if (unclassified.length > 0) sections.push({ title: CUSTOM_SECTION, items: unclassified });
  }

  return (
    <FacultyGate>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
              ← home
            </Link>
            <h1 className="text-2xl font-bold">Case library</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/editor" className="btn-secondary">
              ✏️ New scenario
            </Link>
            <button
              className="btn-ghost"
              onClick={() => {
                // Toggling from the header abandons any card-initiated
                // pending add — otherwise it leaks into the next creation.
                setPendingAddId(null);
                setCreateOpen((v) => !v);
              }}
            >
              📚 New collection
            </button>
            <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
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
            <Link href="/debrief" className="btn-ghost">
              Past sessions
            </Link>
          </div>
        </header>

        {/* Renders nothing unless AI settings are configured. */}
        <SyllabusImportPanel onChanged={refresh} />

        {createOpen && (
          <form
            className="card flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCollection();
            }}
          >
            <input
              className="input w-64"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Collection title (e.g. CA-1 fall block)"
              aria-label="New collection title"
              autoFocus
            />
            <button className="btn-primary" type="submit" disabled={!newTitle.trim()}>
              Create
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setPendingAddId(null);
              }}
            >
              Cancel
            </button>
            {pendingAddId && (
              <span className="text-xs text-slate-500">
                “{scenarioById.get(pendingAddId)?.title ?? pendingAddId}” will be added to it.
              </span>
            )}
          </form>
        )}

        <div className="card ring-1 ring-sky-700/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Quick start — freeform session</h2>
              <p className="mt-1 text-sm text-slate-400">
                Standardized patient, normal baseline vitals, no scripted events — you drive
                everything live.
              </p>
              <div className="mt-2 text-[11px] text-slate-500">~15 min</div>
            </div>
            <Link href={`/faculty/run/${QUICK_START_ID}`} className="btn-primary shrink-0">
              ▶ Quick start
            </Link>
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-slate-800/60 bg-slate-950/95 px-4 py-2 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search scenarios…"
              aria-label="Search scenarios"
            />
            <select
              className="input w-auto"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              aria-label="Filter by difficulty"
            >
              <option value="all">All difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select
              className="input w-auto"
              value={trainingLevel}
              onChange={(e) => setTrainingLevel(e.target.value)}
              aria-label="Filter by training level"
            >
              <option value="all">All training levels</option>
              {Object.entries(TRAINING_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="input w-auto"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Filter by source"
            >
              <option value="all">All sources</option>
              {SOURCE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by domain">
            {DOMAINS.map((d) => (
              <button
                key={d}
                aria-pressed={selectedDomains.has(d)}
                onClick={() => toggleDomain(d)}
                className={`rounded px-2 py-1 text-xs font-semibold transition ${
                  selectedDomains.has(d)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {d}
              </button>
            ))}
            {selectedDomains.size > 0 && (
              <button
                className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-300"
                onClick={() => setSelectedDomains(new Set())}
              >
                ✕ clear
              </button>
            )}
          </div>
        </div>

        {collectionSections.map(({ collection: c, items, missingIds }) => (
          <CollectionSection
            key={c.id}
            collection={c}
            items={items}
            missingIds={missingIds}
            showControls={!filtersActive}
            renderCard={(s) => scenarioCard(s, c.id)}
            onRename={(title) => {
              surface(renameCollection(c.id, title));
              refresh();
            }}
            onDelete={() => {
              deleteCollection(c.id);
              refresh();
              toast(`Collection deleted — its scenarios are untouched`, 'success');
            }}
            onExport={() => exportCollection(c)}
            onSwap={(idA, idB) => {
              surface(swapInCollection(c.id, idA, idB));
              refresh();
            }}
            onRemove={(scenarioId) => {
              surface(removeFromCollection(c.id, scenarioId));
              refresh();
            }}
          />
        ))}

        {q === '' ? (
          sections.map((sec) => (
            <section key={sec.title} className="space-y-3">
              <h2 className="label !mb-0">
                {sec.title}{' '}
                <span className="font-normal normal-case text-slate-600">({sec.items.length})</span>
              </h2>
              <ul className="space-y-3">
                {sec.items.map((s) => (
                  <li key={s.id}>{scenarioCard(s, 'domain')}</li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className="space-y-3">
            {filtered.map((s) => (
              <li key={s.id}>{scenarioCard(s, 'search')}</li>
            ))}
          </ul>
        )}
        {filtered.length === 0 && !anyCollectionItemVisible && (
          <p className="card text-sm text-slate-400">No scenarios match those filters.</p>
        )}
      </main>
    </FacultyGate>
  );

  // sectionKey scopes the expand toggle: the same scenario can render in a
  // collection section AND its domain section, and expanding one copy must
  // not expand the other.
  function scenarioCard(s: Scenario, sectionKey: string) {
    const expandKey = `${sectionKey}:${s.id}`;
    return (
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{s.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{s.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${DIFFICULTY_STYLES[s.tags.difficulty]}`}>
                      {s.tags.difficulty}
                    </span>
                    {customIds.has(s.id) && (
                      <span className="rounded bg-sky-900/60 px-1.5 py-0.5 font-semibold text-sky-300">
                        custom
                      </span>
                    )}
                    {s.tags.topics.map((t) => (
                      <span
                        key={t}
                        className={`rounded px-1.5 py-0.5 ${
                          t === domainOf(s)
                            ? 'bg-slate-700 font-semibold text-slate-200'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                    <span className="text-slate-500">~{s.estimatedMinutes} min</span>
                    {(() => {
                      const badge = cloudBadge(s);
                      return badge ? (
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/faculty/run/${s.id}`} className="btn-primary">
                    ▶ Run
                  </Link>
                  <Link href={`/editor?id=${s.id}`} className="btn-ghost">
                    Edit
                  </Link>
                  <button
                    className="btn-ghost"
                    onClick={() => downloadJson(`${s.id}.json`, JSON.stringify(s, null, 2))}
                    title="Export JSON"
                  >
                    ⬇
                  </button>
                  {customIds.has(s.id) && (
                    <ConfirmButton
                      label="🗑"
                      confirmLabel="Delete custom"
                      title="Delete custom scenario"
                      onConfirm={() => {
                        deleteCustomScenario(s.id);
                        refresh();
                        toast('Custom scenario deleted', 'success');
                      }}
                    />
                  )}
                  <select
                    className="input w-auto !py-1 text-xs"
                    value=""
                    aria-label={`Add ${s.title} to a collection`}
                    onChange={(e) => {
                      // Option values are namespaced ('add:<id>' vs '__new')
                      // so a stored id can never collide with the sentinel.
                      const value = e.target.value;
                      if (value === '__new') {
                        setPendingAddId(s.id);
                        setCreateOpen(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else if (value.startsWith('add:')) {
                        const collectionId = value.slice('add:'.length);
                        const added = addToCollection(collectionId, s.id);
                        refresh();
                        const c = collections.find((x) => x.id === collectionId);
                        if (added.ok) toast(`Added to “${c?.title ?? collectionId}”`, 'success');
                        else toast(added.error, 'error');
                      }
                    }}
                  >
                    <option value="">＋ Collection…</option>
                    {collections.map((c) => (
                      <option
                        key={c.id}
                        value={`add:${c.id}`}
                        disabled={c.scenarioIds.includes(s.id)}
                      >
                        {c.title}
                        {c.scenarioIds.includes(s.id) ? ' ✓' : ''}
                      </option>
                    ))}
                    <option value="__new">New collection…</option>
                  </select>
                </div>
              </div>

              <button
                className="mt-2 text-xs text-sky-400 hover:text-sky-300"
                onClick={() => setExpanded(expanded === expandKey ? null : expandKey)}
              >
                {expanded === expandKey ? 'Hide details ▲' : 'Objectives & setup ▼'}
              </button>
              {expanded === expandKey && (
                <div className="mt-3 grid gap-4 border-t border-slate-800 pt-3 text-sm sm:grid-cols-2">
                  <div>
                    <h3 className="label">Learning objectives</h3>
                    <ul className="list-disc space-y-1 pl-4 text-slate-300">
                      {s.learningObjectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="label">Setup</h3>
                    <ul className="list-disc space-y-1 pl-4 text-slate-300">
                      {s.setup.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
    );
  }
}
