'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible } from '@/lib/cloud/outbox';
import { listCloudSessions, type CloudSessionSummary } from '@/lib/cloud/sessionCloud';
import type { ArchivedSession } from '@/lib/engine/types';
import { deleteSession, listSessions, replaceAllSessions } from '@/lib/store/sessionArchive';
import { mergeImported, parseSessionExport, serializeSessions } from '@/lib/store/sessionExport';

function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = 'date' | 'score' | 'duration';

const SORTERS: Record<SortKey, (a: ArchivedSession, b: ArchivedSession) => number> = {
  date: (a, b) => b.endedAtIso.localeCompare(a.endedAtIso),
  score: (a, b) => b.score.percent - a.score.percent,
  duration: (a, b) => b.snapshot.elapsedSec - a.snapshot.elapsedSec,
};

/** List of completed sessions stored on this device. */
export default function DebriefListPage() {
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [cloudSessions, setCloudSessions] = useState<CloudSessionSummary[] | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const authStatus = useAuthStore((s) => s.status);
  const authRole = useAuthStore((s) => s.profile?.role);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('date');

  useEffect(() => {
    setSessions(listSessions());
    useAuthStore.getState().init();
  }, []);

  useEffect(() => {
    if (!cloudEligible()) return;
    let cancelled = false;
    void listCloudSessions().then((list) => {
      if (!cancelled) setCloudSessions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus, authRole]);

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSessionExport(String(reader.result));
      if (!parsed.ok) {
        setNotice({ kind: 'error', text: parsed.errors.join(' ') });
        return;
      }
      const { merged, added, skipped } = mergeImported(listSessions(), parsed.sessions);
      if (!replaceAllSessions(merged)) {
        setNotice({
          kind: 'error',
          text: 'Device storage is full — nothing was imported. Delete old sessions and retry.',
        });
        return;
      }
      setSessions(listSessions());
      setNotice({
        kind: 'ok',
        text: `Imported ${added} session${added === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped — already on this device or over the 50-session cap)` : ''}.`,
      });
    };
    reader.readAsText(file);
  };

  const q = query.trim().toLowerCase();
  const visible = sessions
    .filter(
      (s) =>
        q === '' ||
        s.scenario.title.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q),
    )
    .sort(SORTERS[sort]);

  return (
    <FacultyGate>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← home
          </Link>
          <h1 className="text-2xl font-bold">Past sessions</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sessions are stored on this device. Open one for the full timeline, scores, and PDF
            export. Use JSON export to back up session history or move it to another machine.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() =>
              downloadJson(
                `capno-sessions-${new Date().toISOString().slice(0, 10)}.json`,
                serializeSessions(sessions),
              )
            }
            disabled={sessions.length === 0}
          >
            ⬇ Export all (JSON)
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
        </div>

        {notice && (
          <div
            className={`rounded-md p-3 text-sm ring-1 ${
              notice.kind === 'ok'
                ? 'bg-emerald-950/60 text-emerald-300 ring-emerald-800'
                : 'bg-red-950/60 text-red-300 ring-red-800'
            }`}
          >
            {notice.text}
          </div>
        )}

        {sessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by scenario or code…"
              aria-label="Search sessions"
            />
            <select
              className="input w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort sessions"
            >
              <option value="date">Newest first</option>
              <option value="score">Highest score</option>
              <option value="duration">Longest</option>
            </select>
          </div>
        )}

        <ul className="space-y-2">
          {visible.map((s) => (
            <li key={s.sessionId} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">{s.scenario.title}</h2>
                <p className="text-xs text-slate-500">
                  {new Date(s.endedAtIso).toLocaleString()} · session {s.sessionId} ·{' '}
                  {Math.floor(s.snapshot.elapsedSec / 60)} min · score {s.score.percent}%
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/debrief/${s.sessionId}`} className="btn-primary">
                  Open report
                </Link>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    downloadJson(`capno-session-${s.sessionId}.json`, serializeSessions([s]))
                  }
                >
                  Export
                </button>
                <ConfirmButton
                  label="Delete"
                  confirmLabel="Confirm delete"
                  onConfirm={() => {
                    deleteSession(s.sessionId);
                    setSessions(listSessions());
                  }}
                />
              </div>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="card text-sm text-slate-400">
              No completed sessions yet. Run a scenario from the{' '}
              <Link href="/scenarios" className="text-sky-400 underline">
                library
              </Link>{' '}
              and end it to generate a debrief.
            </li>
          )}
          {sessions.length > 0 && visible.length === 0 && (
            <li className="card text-sm text-slate-400">No sessions match “{query}”.</li>
          )}
        </ul>

        {cloudSessions !== null && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Institution archive</h2>
            <p className="text-sm text-slate-400">
              Sessions pushed by faculty accounts across all devices. Read-only here — amendments
              happen on the device that ran the session and re-sync automatically.
            </p>
            <ul className="space-y-2">
              {cloudSessions.map((s) => (
                <li
                  key={s.cloudId}
                  className="card flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="text-xs text-slate-500">
                      {s.endedAtIso ? new Date(s.endedAtIso).toLocaleString() : ''} · score{' '}
                      {s.percent}%
                      {s.learnerNames.length > 0 ? ` · ${s.learnerNames.join(', ')}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/debrief/cloud/${encodeURIComponent(s.cloudId)}`}
                    className="btn-secondary"
                  >
                    Open report
                  </Link>
                </li>
              ))}
              {cloudSessions.length === 0 && (
                <li className="card text-sm text-slate-400">
                  No sessions in the institution archive yet.
                </li>
              )}
            </ul>
          </section>
        )}
      </main>
    </FacultyGate>
  );
}
