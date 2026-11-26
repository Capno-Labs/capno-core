'use client';

import { useEffect, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { PageHead } from '@/components/ui/PageHead';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/lib/cloud/authStore';
import { cloudEligible } from '@/lib/cloud/outbox';
import { listCloudSessions, type CloudSessionSummary } from '@/lib/cloud/sessionCloud';
import type { ArchivedSession } from '@/lib/engine/types';
import { deleteSession, listSessions, replaceAllSessions } from '@/lib/store/sessionArchive';
import { downloadJson } from '@/lib/download';
import { confirmDialog } from '@/lib/store/dialogStore';
import { toast } from '@/lib/store/toastStore';
import { mergeImported, parseSessionExport, serializeSessions } from '@/lib/store/sessionExport';

type SortKey = 'date' | 'duration';

const SORTERS: Record<SortKey, (a: ArchivedSession, b: ArchivedSession) => number> = {
  date: (a, b) => b.endedAtIso.localeCompare(a.endedAtIso),
  duration: (a, b) => b.snapshot.elapsedSec - a.snapshot.elapsedSec,
};

/** List of completed sessions stored on this device. */
export default function DebriefListPage() {
  // null until the device archive has been read (avoids an empty-state flash).
  const [sessions, setSessions] = useState<ArchivedSession[] | null>(null);
  const [cloudSessions, setCloudSessions] = useState<CloudSessionSummary[] | null>(null);
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
        toast(parsed.errors.join(' '), 'error');
        return;
      }
      const { merged, added, skipped } = mergeImported(listSessions(), parsed.sessions);
      if (!replaceAllSessions(merged)) {
        toast('Device storage is full — nothing was imported. Delete old sessions and retry.', 'error');
        return;
      }
      setSessions(listSessions());
      toast(
        `Imported ${added} session${added === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped — already on this device or over the 50-session cap)` : ''}.`,
        'success',
      );
    };
    reader.readAsText(file);
  };

  const q = query.trim().toLowerCase();
  const visible = (sessions ?? [])
    .filter(
      (s) =>
        q === '' ||
        s.scenario.title.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q),
    )
    .sort(SORTERS[sort]);

  return (
    <FacultyGate>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHead
          eyebrow="Debriefs"
          title="Debrief while it's fresh."
          lede="Sessions are stored on this device. Open one to walk the room through the debrief, check the record, or export a PDF. Use JSON export to back up session history or move it to another machine."
          actions={
            <>
              <Button
                variant="secondary"
                icon="download"
                onClick={() =>
                  downloadJson(
                    `capno-sessions-${new Date().toISOString().slice(0, 10)}.json`,
                    serializeSessions(sessions ?? []),
                  )
                }
                disabled={!sessions || sessions.length === 0}
              >
                Export all
              </Button>
              <Button variant="secondary" icon="upload" onClick={() => fileInput.current?.click()}>
                Import
              </Button>
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

        {sessions === null && (
          <div className="space-y-2" role="status">
            <span className="sr-only">Loading sessions…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full !rounded-card" />
            ))}
          </div>
        )}

        {sessions !== null && sessions.length === 0 && (
          <EmptyState
            icon="debrief"
            title="No debriefs yet."
            body="Run a case and end the session — the debrief walkthrough and its printable record appear here."
            action={
              <Button variant="primary" href="/scenarios" arrow>
                Open the case library
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>
                Import sessions
              </Button>
            }
          />
        )}

        {sessions !== null && sessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-full sm:w-64"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by case or code…"
              aria-label="Search sessions"
            />
            <select
              className="input w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort sessions"
            >
              <option value="date">Newest first</option>
              <option value="duration">Longest</option>
            </select>
          </div>
        )}

        <ul className="space-y-2">
          {visible.map((s) => (
            <li key={s.sessionId} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{s.scenario.title}</h2>
                <p className="font-mono text-[11px] text-faint">
                  {new Date(s.endedAtIso).toLocaleString()} · session {s.sessionId} ·{' '}
                  {Math.floor(s.snapshot.elapsedSec / 60)} min
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" href={`/debrief/${s.sessionId}`} arrow>
                  Open debrief
                </Button>
                <Menu label={`More actions for session ${s.sessionId}`}>
                  <MenuItem
                    icon="download"
                    onSelect={() =>
                      downloadJson(`capno-session-${s.sessionId}.json`, serializeSessions([s]))
                    }
                  >
                    Export JSON
                  </MenuItem>
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    onSelect={() => {
                      void confirmDialog({
                        title: 'Delete this debrief?',
                        body: `The report for “${s.scenario.title}” (session ${s.sessionId}) will be removed from this device. Export it first if you need a copy.`,
                        confirmLabel: 'Delete debrief',
                        tone: 'danger',
                      }).then((ok) => {
                        if (!ok) return;
                        deleteSession(s.sessionId);
                        setSessions(listSessions());
                        toast('Debrief deleted', 'success');
                      });
                    }}
                  >
                    Delete debrief
                  </MenuItem>
                </Menu>
              </div>
            </li>
          ))}
          {sessions !== null && sessions.length > 0 && visible.length === 0 && (
            <li className="card text-sm text-muted">No sessions match “{query}”.</li>
          )}
        </ul>

        {cloudSessions !== null && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Institution archive</h2>
            <p className="text-sm text-muted">
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
                    <p className="text-xs text-faint">
                      {s.endedAtIso ? new Date(s.endedAtIso).toLocaleString() : ''}
                      {s.learnerNames.length > 0 ? ` · ${s.learnerNames.join(', ')}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    href={`/debrief/cloud/${encodeURIComponent(s.cloudId)}`}
                    arrow
                  >
                    Open debrief
                  </Button>
                </li>
              ))}
              {cloudSessions.length === 0 && (
                <li className="card text-sm text-muted">
                  No sessions in the institution archive yet.
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </FacultyGate>
  );
}
