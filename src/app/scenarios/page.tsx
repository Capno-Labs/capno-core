'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible, drain, getPushedAt, isQueued } from '@/lib/cloud/outbox';
import { mergeCloudScenarios, pullScenarios } from '@/lib/cloud/scenarioCloud';
import { parseScenario, validateScenario } from '@/lib/engine/schema';
import type { Difficulty, Scenario } from '@/lib/engine/types';
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
  const [topic, setTopic] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
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

  const topics = useMemo(
    () => Array.from(new Set(scenarios.flatMap((s) => s.tags.topics))).sort(),
    [scenarios],
  );

  const q = query.trim().toLowerCase();
  const filtered = scenarios.filter(
    (s) =>
      (topic === 'all' || s.tags.topics.includes(topic)) &&
      (difficulty === 'all' || s.tags.difficulty === difficulty) &&
      (q === '' ||
        `${s.title} ${s.summary} ${s.tags.topics.join(' ')}`.toLowerCase().includes(q)),
  );

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

        <div className="flex flex-wrap gap-2">
          <input
            className="input w-56"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scenarios…"
            aria-label="Search scenarios"
          />
          <select className="input w-auto" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by topic">
            <option value="all">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
        </div>

        <ul className="space-y-3">
          {filtered.map((s) => (
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
                      <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
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
          ))}
          {filtered.length === 0 && (
            <li className="card text-sm text-slate-400">No scenarios match those filters.</li>
          )}
        </ul>
      </main>
    </FacultyGate>
  );
}
