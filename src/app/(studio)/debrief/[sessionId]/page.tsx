'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DebriefDeck } from '@/components/debrief/DebriefDeck';
import { DebriefReport, type DebriefAmend } from '@/components/debrief/DebriefReport';
import { Eyebrow } from '@/components/ui/PageHead';
import { cloudEligible, drain, enqueue } from '@/lib/cloud/outbox';
import '@/lib/cloud/sessionCloud'; // registers the session push handler
import { DECK_COPY } from '@/lib/debrief/deckCopy';
import { downloadJson } from '@/lib/download';
import { scoreSession } from '@/lib/engine/scoring';
import type { ArchivedSession } from '@/lib/engine/types';
import { getSession, isMemoryOnly, updateSession } from '@/lib/store/sessionArchive';
import { serializeSessions } from '@/lib/store/sessionExport';

export default function DebriefSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<ArchivedSession | null | undefined>(undefined);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    setSession(getSession(params.sessionId) ?? null);
  }, [params.sessionId]);

  if (session === undefined) return <PageSkeleton kind="report" />;

  // Amended sessions re-push to the institution archive (idempotent upsert).
  const repush = (sessionId: string) => {
    if (cloudEligible()) {
      enqueue('session', sessionId);
      void drain();
    }
  };

  // Post-hoc amendments: statuses are re-marked in debrief and the archive
  // record is updated. The score is no longer shown in the studio, but it is
  // still recomputed with the same policy so the stored record (JSON export,
  // institution archive, cohort analytics) stays true to the marks.
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
        setNotes: (notes) => {
          const updated = updateSession(session.sessionId, {
            snapshot: { ...session.snapshot, notes },
          });
          if (updated) {
            setSession(updated);
            repush(updated.sessionId);
          }
        },
      }
    : undefined;

  if (session === null) {
    return (
      <FacultyGate>
        <EmptyState
          icon="debrief"
          title="Debrief not found."
          body={
            <>
              Session “{params.sessionId}” is not on this device. Reports live in the browser that
              ran the session — or in the institution archive when you are signed in.
            </>
          }
          action={
            <Button variant="primary" href="/debrief" arrow>
              All debriefs
            </Button>
          }
        />
      </FacultyGate>
    );
  }

  const runNextHref = `/faculty/run/${session.scenario.id}?code=${session.sessionCode ?? session.sessionId}`;

  return (
    <FacultyGate>
      <div className="mx-auto max-w-4xl space-y-4">
        {isMemoryOnly(session.sessionId) && (
          <Callout tone="warn" title="Device storage is full" className="no-print">
            This debrief is held in memory only and will be lost when the tab closes. Export it now
            (PDF, or JSON once available) and free up space.
          </Callout>
        )}
        <header className="no-print card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 !p-5">
          <div className="min-w-0">
            <div className="mb-1.5">
              <Eyebrow>Session report</Eyebrow>
            </div>
            <p className="truncate text-2xl font-bold tracking-[-0.02em]">
              {session.scenario.title}
            </p>
            <p className="mt-1 text-xs text-muted">
              Completed {new Date(session.endedAtIso).toLocaleString()} ·{' '}
              {Math.floor(session.snapshot.elapsedSec / 60)} min · session {session.sessionId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon="fullscreen"
              onClick={() => setPresenting(true)}
              title="Walk the room through the debrief, one card at a time"
            >
              Start debrief
            </Button>
            <Button
              variant="secondary"
              icon="play"
              href={runNextHref}
              title="Relaunch this scenario fresh on the same session code — connected student displays reconnect without re-joining"
            >
              Run next student
            </Button>
            <Button variant="secondary" icon="print" onClick={() => window.print()}>
              Export PDF
            </Button>
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                downloadJson(`capno-session-${session.sessionId}.json`, serializeSessions([session]))
              }
            >
              Export JSON
            </Button>
          </div>
        </header>
        <DebriefReport session={session} amend={amend} />
      </div>
      <DebriefDeck
        session={session}
        open={presenting}
        onClose={() => setPresenting(false)}
        onAddTakeaway={(text) =>
          amend?.setNotes([
            ...session.snapshot.notes,
            {
              t: session.snapshot.elapsedSec,
              text: `${DECK_COPY.takeaways.notePrefix}${text}`,
              postHoc: true,
            },
          ])
        }
        endActions={
          <Button variant="primary" icon="play" href={runNextHref}>
            Run next student
          </Button>
        }
      />
    </FacultyGate>
  );
}
