'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { DebriefReport } from '@/components/debrief/DebriefReport';
import { useAuthStore } from '@/lib/cloud/authStore';
import { fetchCloudSession } from '@/lib/cloud/sessionCloud';
import type { ArchivedSession } from '@/lib/engine/types';

/**
 * Read-only debrief for a session from the institution archive. Rendered
 * from memory — nothing is written to this device's local archive, and
 * amendments require the device that ran the session.
 */
export default function CloudDebriefPage() {
  const params = useParams<{ cloudId: string }>();
  const authStatus = useAuthStore((s) => s.status);
  const authRole = useAuthStore((s) => s.profile?.role);
  const [session, setSession] = useState<ArchivedSession | null | undefined>(undefined);

  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  useEffect(() => {
    if (authStatus !== 'signed_in') return;
    let cancelled = false;
    void fetchCloudSession(decodeURIComponent(params.cloudId)).then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, [params.cloudId, authStatus, authRole]);

  return (
    <FacultyGate>
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.11em] text-amber-strong">
            <span aria-hidden className="h-0.5 w-4 bg-amber" />
            Institution archive
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-faint">
              Institution archive — read-only (amend on the device that ran the session)
            </span>
            <button className="btn-primary" onClick={() => window.print()}>
              🖨 Export PDF
            </button>
          </div>
        </header>
        {session === undefined && (
          <p className="text-sm text-muted">Loading from the institution archive…</p>
        )}
        {session === null && (
          <p className="text-sm text-muted">
            Session not found in the institution archive, or your account cannot read it.
          </p>
        )}
        {session && <DebriefReport session={session} />}
      </div>
    </FacultyGate>
  );
}
