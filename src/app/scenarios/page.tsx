'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, getPushedAt, isQueued } from '@/lib/cloud/outbox';
import { mergeCloudScenarios, pullScenarios } from '@/lib/cloud/scenarioCloud';
import { DOMAINS, domainOf } from '@/lib/engine/lint';
import { parseScenario, validateScenario } from '@/lib/engine/schema';
import type { Difficulty, Scenario, TrainingLevel } from '@/lib/engine/types';
import { TRAINING_LEVEL_LABELS } from '@/lib/engine/types';
import { AI_GENERATED_TAG } from '@/lib/llm/generator';
import {
  BUILT_IN_SCENARIOS,
  QUICK_START_ID,
  deleteCustomScenario,
  listAllScenarios,
  listCustomScenarios,
  saveCustomScenario,
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

function downloadScenario(s: Scenario) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${s.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Scenario library: browse, filter by tags, run, edit, export. */
export default function ScenarioLibraryPage() {
  // Custom scenarios come from localStorage, so resolve after mount.
  const [scenarios, setScenarios] = useState<Scenario[]>(BUILT_IN_SCENARIOS);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<string>('all');
  const [trainingLevel, setTrainingLevel] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const authStatus = useAuthStore((s) => s.status);
  const authRole = useAuthStore((s) => s.profile?.role);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = () => {
    setScenarios(listAllScenarios());
    setCustomIds(new Set(listCustomScenarios().map((s) => s.id)));
  };

  useEffect(() => {
    refresh();
    useAuthStore.getState().init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const check = validateScenario(raw);
        if (!check.ok) {
          toast(`Import failed: ${check.errors[0]}`, 'error');
          return;
        }
        const parsed = parseScenario(raw);
        saveCustomScenario(parsed);
        refresh();
        toast(`Imported “${parsed.title}”`, 'success');
      } catch (e) {
        toast(`Import failed: ${e instanceof Error ? e.message : 'invalid JSON'}`, 'error');
      }
    };
    reader.readAsText(file);
  };

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
  const filtered = scenarios.filter(
    (s) =>
      (selectedDomains.size === 0 ||
        (() => {
          const d = domainOf(s);
          return d !== undefined && selectedDomains.has(d);
        })()) &&
      (difficulty === 'all' || s.tags.difficulty === difficulty) &&
      (trainingLevel === 'all' ||
        s.tags.trainingLevels.includes(trainingLevel as TrainingLevel)) &&
      (source === 'all' || matchesSource(s, source as SourceFilter)) &&
      (q === '' ||
        `${s.title} ${s.summary} ${s.tags.topics.join(' ')}`.toLowerCase().includes(q)),
  );

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
          <div className="flex gap-2">
            <Link href="/editor" className="btn-secondary">
              ✏️ New scenario
            </Link>
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

        {q === '' ? (
          sections.map((sec) => (
            <section key={sec.title} className="space-y-3">
              <h2 className="label !mb-0">
                {sec.title}{' '}
                <span className="font-normal normal-case text-slate-600">({sec.items.length})</span>
              </h2>
              <ul className="space-y-3">{sec.items.map(scenarioCard)}</ul>
            </section>
          ))
        ) : (
          <ul className="space-y-3">{filtered.map(scenarioCard)}</ul>
        )}
        {filtered.length === 0 && (
          <p className="card text-sm text-slate-400">No scenarios match those filters.</p>
        )}
      </main>
    </FacultyGate>
  );

  function scenarioCard(s: Scenario) {
    return (
            <li key={s.id} className="card">
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
                <div className="flex shrink-0 gap-2">
                  <Link href={`/faculty/run/${s.id}`} className="btn-primary">
                    ▶ Run
                  </Link>
                  <Link href={`/editor?id=${s.id}`} className="btn-ghost">
                    Edit
                  </Link>
                  <button className="btn-ghost" onClick={() => downloadScenario(s)} title="Export JSON">
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
                </div>
              </div>

              <button
                className="mt-2 text-xs text-sky-400 hover:text-sky-300"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                {expanded === s.id ? 'Hide details ▲' : 'Objectives & setup ▼'}
              </button>
              {expanded === s.id && (
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
            </li>
    );
  }
}
