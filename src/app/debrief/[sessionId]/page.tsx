'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { DebriefReport, type DebriefAmend } from '@/components/debrief/DebriefReport';
import { cloudEligible, drain, enqueue } from '@/lib/cloud/outbox';
import '@/lib/cloud/sessionCloud'; // registers the session push handler
import { downloadJson } from '@/lib/download';
import { scoreSession } from '@/lib/engine/scoring';
import type { ArchivedSession } from '@/lib/engine/types';
import { getSession, isMemoryOnly, updateSession } from '@/lib/store/sessionArchive';
import { serializeSessions } from '@/lib/store/sessionExport';

export default function DebriefSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<ArchivedSession | null | undefined>(undefined);

  useEffect(() => {
    setSession(getSession(params.sessionId) ?? null);
  }, [params.sessionId]);

  if (session === undefined) return null;

  // Amended sessions re-push to the institution archive (idempotent upsert).
  const repush = (sessionId: string) => {
    if (cloudEligible()) {
      enqueue('session', sessionId);
      void drain();
    }
  };

  // Post-hoc amendments: statuses are re-marked in debrief, the score is
  // recomputed with the same policy, and the archive record is updated.
  const amend: DebriefAmend | undefined = session
    ? {
        markAction: (actionId, status) => {
          const actions = session.snapshot.actions.map((a) =>
            a.actionId === actionId ? { ...a, status } : a,
          );
          const updated = updateSession(session.sessionId, {
            snapshot: { ...session.snapshot, actions },
            score: scoreSession(session.scenario, actions),
          });
          if (updated) {
            setSession(updated);
            repush(updated.sessionId);
          }
        },
        setLearners: (names) => {
          const updated = updateSession(session.sessionId, { learnerNames: names });
          if (updated) {
            setSession(updated);
            repush(updated.sessionId);
          }
        },
      }
    : undefined;

  if (session === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-300">Session “{params.sessionId}” not found on this device.</p>
        <Link href="/debrief" className="btn-primary">
          All sessions
        </Link>
      </main>
    );
  }

  return (
    <FacultyGate>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        {isMemoryOnly(session.sessionId) && (
          <div className="no-print rounded-md bg-amber-950/60 p-3 text-sm text-amber-300 ring-1 ring-amber-700">
            Device storage is full — this debrief is held in memory only and will be lost when the
            tab closes. Export it now (PDF, or JSON once available) and free up space.
          </div>
        )}
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href="/debrief" className="text-xs text-slate-500 hover:text-slate-300">
            ← all sessions
          </Link>
          <div className="flex gap-2">
            <Link
              className="btn-primary"
              href={`/faculty/run/${session.scenario.id}?code=${session.sessionCode ?? session.sessionId}`}
              title="Relaunch this scenario fresh on the same session code — connected student displays reconnect without re-joining"
            >
              ▶ Run next student
            </Link>
            <button className="btn-primary" onClick={() => window.print()}>
              🖨 Export PDF
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                downloadJson(`capno-session-${session.sessionId}.json`, serializeSessions([session]))
              }
            >
              ⬇ Export JSON
            </button>
          </div>
        </header>
        <DebriefReport session={session} amend={amend} />
      </main>
    </FacultyGate>
  );
}
