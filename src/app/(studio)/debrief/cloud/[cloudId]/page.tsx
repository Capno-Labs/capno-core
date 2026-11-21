'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Eyebrow } from '@/components/ui/PageHead';
import { PageSkeleton } from '@/components/ui/Skeleton';
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
          <Eyebrow>Institution archive</Eyebrow>
          <div className="flex items-center gap-3">
            <span className="text-xs text-faint">
              Read-only — amend on the device that ran the session
            </span>
            <Button
              variant="primary"
              icon="print"
              onClick={() => window.print()}
              disabled={!session}
            >
              Export PDF
            </Button>
          </div>
        </header>
        {/* The archive needs a signed-in account; say so instead of loading forever. */}
        {authStatus === 'unconfigured' && (
          <EmptyState
            icon="cloud"
            title="No institution archive here."
            body="This installation is not connected to a cloud backend, so there is no shared archive. Debriefs from this device are under Debriefs."
            action={
              <Button variant="primary" href="/debrief" arrow>
                All debriefs
              </Button>
            }
          />
        )}
        {authStatus === 'signed_out' && (
          <EmptyState
            icon="user"
            title="Sign in to open this debrief."
            body="Reports in the institution archive are only visible to signed-in faculty."
            action={
              <Button variant="primary" href="/account" arrow>
                Sign in
              </Button>
            }
          />
        )}
        {(authStatus === 'loading' || (authStatus === 'signed_in' && session === undefined)) && (
          <PageSkeleton kind="report" />
        )}
        {authStatus === 'signed_in' && session === null && (
          <EmptyState
            icon="debrief"
            title="Debrief not found."
            body="It is not in the institution archive, or your account cannot read it."
            action={
              <Button variant="primary" href="/debrief" arrow>
                All debriefs
              </Button>
            }
          />
        )}
        {authStatus === 'signed_in' && session && <DebriefReport session={session} />}
      </div>
    </FacultyGate>
  );
}
