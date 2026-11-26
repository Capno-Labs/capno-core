'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { CollectionSection } from '@/components/library/CollectionSection';
import { SyllabusImportPanel } from '@/components/library/SyllabusImportPanel';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { PageHead } from '@/components/ui/PageHead';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Poster } from '@/components/ui/Poster';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, enqueue, getPushedAt, isQueued } from '@/lib/cloud/outbox';
import { mergeCloudScenarios, pullScenarios } from '@/lib/cloud/scenarioCloud';
import { DISPLAY_COPY } from '@/lib/displayCopy';
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
import { clearDraft, listDraftCaseIds } from '@/lib/scenarios/draftStore';
import { duplicateScenario } from '@/lib/scenarios/scenarioId';
import { confirmDialog } from '@/lib/store/dialogStore';
import { toast } from '@/lib/store/toastStore';

const DIFFICULTY_TONE: Record<Difficulty, PillTone> = {
  beginner: 'green',
  intermediate: 'warn',
  advanced: 'red',
};

/** Section id for scenarios without a curriculum-domain tag. */
const CUSTOM_SECTION = 'Custom & drafts';

const SOURCE_OPTIONS = ['built-in', 'custom', 'cloud', 'ai draft'] as const;
type SourceFilter = (typeof SOURCE_OPTIONS)[number];

/** Case library: collections, browse, filter by tags, run, edit, export. */
export default function ScenarioLibraryPage() {
  const router = useRouter();
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
  /** Cases with unsaved edits waiting in the editor (draftStore.ts). */
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [startFrom, setStartFrom] = useState('');
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
    setDraftIds(new Set(listDraftCaseIds()));
  };

  /** A copy with its own id and history — the original is untouched. */
  const duplicate = (source: Scenario) => {
    const all = listAllScenarios();
    const copy = duplicateScenario(
      source,
      new Set(all.map((s) => s.id)),
      new Set(all.map((s) => s.title)),
    );
    const saved = saveCustomScenario(copy);
    if (!saved.ok) {
      toast(saved.error, 'error');
      return;
    }
    if (cloudEligible()) {
      enqueue('scenario', copy.id);
      void drain();
    }
    refresh();
    toast(`Duplicated as “${copy.title}”`, 'success', {
      label: 'Edit',
      onClick: () => router.push(`/editor?id=${copy.id}`),
    });
  };

  useEffect(() => {
    refresh();
    useAuthStore.getState().init();
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

  const cloudBadge = (s: Scenario): { label: string; tone: PillTone } | null => {
    if (builtInIds.has(s.id)) return null; // bundled — always available, never synced
    if (authStatus !== 'signed_in') return null;
    if (isQueued('scenario', s.id)) return { label: 'sync pending', tone: 'warn' };
    if (getPushedAt('scenario', s.id)) return { label: 'cloud', tone: 'brand' };
    return { label: 'local only', tone: 'neutral' };
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
  const clearFilters = () => {
    setSelectedDomains(new Set());
    setDifficulty('all');
    setTrainingLevel('all');
    setSource('all');
    setQuery('');
  };

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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHead
          eyebrow="Case library"
          title="What are you teaching?"
          lede="Reviewed cases, your drafts, and collections in one place."
          actions={
            <>
              <Button variant="primary" icon="plus" onClick={() => setNewCaseOpen(true)}>
                New case
              </Button>
              <Menu label="Import" icon="upload" showLabel triggerClassName="btn-secondary">
                <MenuItem icon="file" onSelect={() => router.push('/scenarios/import')}>
                  Run sheet (document)
                </MenuItem>
                <MenuItem icon="code" onSelect={() => fileInput.current?.click()}>
                  Case or collection (JSON)
                </MenuItem>
              </Menu>
              <Menu label="More library actions">
                <MenuItem
                  icon="folder"
                  onSelect={() => {
                    // Opening from the header abandons any card-initiated
                    // pending add — otherwise it leaks into the next creation.
                    setPendingAddId(null);
                    setCreateOpen(true);
                  }}
                >
                  New collection
                </MenuItem>
              </Menu>
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
            </>
          }
        />

        {/* Renders nothing unless AI settings are configured. */}
        <SyllabusImportPanel onChanged={refresh} />

        <Dialog open={newCaseOpen} onClose={() => setNewCaseOpen(false)} title="New case">
          <div className="space-y-4">
            <div className="space-y-2">
              <p>Start with an empty case and fill it in.</p>
              <Button variant="primary" href="/editor" icon="plus" data-autofocus>
                Blank case
              </Button>
            </div>
            <form
              className="space-y-2 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (startFrom) router.push(`/editor?from=${encodeURIComponent(startFrom)}`);
              }}
            >
              <label className="label" htmlFor="new-case-from">
                Or start from a copy of an existing case
              </label>
              <select
                id="new-case-from"
                className="input"
                value={startFrom}
                onChange={(e) => setStartFrom(e.target.value)}
              >
                <option value="">Choose a case…</option>
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                    {customIds.has(sc.id) ? ' (yours)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-faint">
                The original is not changed. The copy gets its own name and history when you save it.
              </p>
              <Button variant="secondary" type="submit" disabled={!startFrom}>
                Start from this case
              </Button>
            </form>
          </div>
        </Dialog>

        <Dialog
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setPendingAddId(null);
          }}
          title="New collection"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCollection();
            }}
          >
            <p>
              Group cases the way your syllabus does — a block, a rotation, a sim day.
              {pendingAddId && (
                <>
                  {' '}
                  “{scenarioById.get(pendingAddId)?.title ?? pendingAddId}” will be added to it.
                </>
              )}
            </p>
            <Field label="Collection title">
              <input
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. CA-1 fall block"
                data-autofocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  setPendingAddId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!newTitle.trim()}>
                Create collection
              </Button>
            </div>
          </form>
        </Dialog>

        <Poster
          compact
          as="h2"
          label="Freeform session / ~15 min"
          titleLines={[...DISPLAY_COPY.quickStart]}
          promise="Standardized patient, normal baseline vitals, no scripted events — you drive everything live."
          actions={
            <Button variant="onBlue" href={`/faculty/run/${QUICK_START_ID}`} icon="play">
              Quick start
            </Button>
          }
        />

        <div className="sticky top-[var(--topbar-h)] z-10 -mx-4 space-y-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:-mx-7 md:px-7">
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases…"
              aria-label="Search cases"
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
                type="button"
                aria-pressed={selectedDomains.has(d)}
                onClick={() => toggleDomain(d)}
                className="chip"
              >
                {d}
              </button>
            ))}
            {(filtersActive || q !== '') && (
              <button
                type="button"
                className="link px-1.5 py-1 text-xs"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto font-mono text-[11px] text-faint" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? 'case' : 'cases'}
            </span>
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
              toast('Collection deleted — its cases are untouched', 'success');
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
                <span className="font-normal normal-case text-faint">({sec.items.length})</span>
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
          <EmptyState
            icon="search"
            title="No cases match."
            body="Nothing fits those filters. Clear them to see the whole library, or build a new case."
            action={
              <Button variant="primary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" href="/editor" icon="plus">
                New case
              </Button>
            }
          />
        )}
      </div>
    </FacultyGate>
  );

  // sectionKey scopes the expand toggle: the same scenario can render in a
  // collection section AND its domain section, and expanding one copy must
  // not expand the other.
  function scenarioCard(s: Scenario, sectionKey: string) {
    const expandKey = `${sectionKey}:${s.id}`;
    const inCollection = (c: ScenarioCollection) => c.scenarioIds.includes(s.id);
    const open = expanded === expandKey;
    return (
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.summary}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <Pill tone={DIFFICULTY_TONE[s.tags.difficulty]}>{s.tags.difficulty}</Pill>
              {customIds.has(s.id) && <Pill tone="brand">custom</Pill>}
              {draftIds.has(s.id) && (
                <Pill tone="warn" title="Edits made in the editor that are not saved as a version yet">
                  unsaved edits
                </Pill>
              )}
              {s.tags.topics.map((t) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 ${
                    t === domainOf(s) ? 'bg-panel-3 font-semibold text-ink' : 'bg-panel-2 text-muted'
                  }`}
                >
                  {t}
                </span>
              ))}
              <span className="font-mono text-faint">~{s.estimatedMinutes} min</span>
              {(() => {
                const badge = cloudBadge(s);
                return badge ? <Pill tone={badge.tone}>{badge.label}</Pill> : null;
              })()}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="primary" href={`/faculty/run/${s.id}`} icon="play">
              Run
            </Button>
            <Button variant="ghost" href={`/editor?id=${s.id}`} icon="edit">
              Edit
            </Button>
            <Menu label={`More actions for ${s.title}`}>
              <MenuItem
                icon="download"
                onSelect={() => downloadJson(`${s.id}.json`, JSON.stringify(s, null, 2))}
              >
                Export JSON
              </MenuItem>
              <MenuItem icon="copy" onSelect={() => duplicate(s)}>
                Duplicate
              </MenuItem>
              {collections.map((c) => (
                <MenuItem
                  key={c.id}
                  icon={inCollection(c) ? 'check' : 'folder'}
                  disabled={inCollection(c)}
                  onSelect={() => {
                    const added = addToCollection(c.id, s.id);
                    refresh();
                    if (added.ok) toast(`Added to “${c.title}”`, 'success');
                    else toast(added.error, 'error');
                  }}
                >
                  {inCollection(c) ? `In “${c.title}”` : `Add to “${c.title}”`}
                </MenuItem>
              ))}
              <MenuItem
                icon="plus"
                onSelect={() => {
                  setPendingAddId(s.id);
                  setCreateOpen(true);
                }}
              >
                Add to a new collection…
              </MenuItem>
              {customIds.has(s.id) && (
                <MenuItem
                  icon="trash"
                  tone="danger"
                  onSelect={() => {
                    void confirmDialog({
                      title: 'Delete this case?',
                      body: `“${s.title}” will be removed from this device. Debriefs from past sessions are kept.`,
                      confirmLabel: 'Delete case',
                      tone: 'danger',
                    }).then((ok) => {
                      if (!ok) return;
                      deleteCustomScenario(s.id);
                      clearDraft(s.id);
                      refresh();
                      toast('Case deleted', 'success');
                    });
                  }}
                >
                  Delete case
                </MenuItem>
              )}
            </Menu>
          </div>
        </div>

        <button
          type="button"
          className="link mt-3 inline-flex items-center gap-1 text-xs"
          aria-expanded={open}
          onClick={() => setExpanded(open ? null : expandKey)}
        >
          {open ? 'Hide details' : 'Objectives & setup'}
          <Icon name="chevron-down" size={13} className={open ? 'rotate-180' : ''} />
        </button>
        {open && (
          <div className="mt-3 grid gap-4 border-t border-line pt-3 text-sm sm:grid-cols-2">
            <div>
              <h4 className="label">Learning objectives</h4>
              <ul className="list-disc space-y-1 pl-4 text-ink-2">
                {s.learningObjectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="label">Setup</h4>
              <ul className="list-disc space-y-1 pl-4 text-ink-2">
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
