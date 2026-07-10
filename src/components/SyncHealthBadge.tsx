'use client';

import type { TransportHealth, TransportState } from '@/lib/sync';

/**
 * Tiny sync-health indicator. "Local" (BroadcastChannel, same-device tabs)
 * is effectively always up; "Cloud" (Supabase realtime) is only shown when
 * that transport is in play, colored by connection state.
 */

const DOT: Record<TransportState, string> = {
  connecting: 'bg-amber-400',
  connected: 'bg-emerald-400',
  error: 'bg-red-500',
  closed: 'bg-slate-600',
};

const CLOUD_TITLE: Record<TransportState, string> = {
  connecting: 'Cloud sync connecting…',
  connected: 'Cloud sync connected — other devices receive live vitals',
  error: 'Cloud sync degraded — displays on other devices may be stale',
  closed: 'Cloud sync closed',
};

export function SyncHealthBadge({ health }: { health: TransportHealth[] }) {
  if (health.length === 0) return null;
  const local = health.find((h) => h.kind === 'broadcast');
  const cloud = health.find((h) => h.kind === 'supabase');
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
      {local && (
        <span
          className="inline-flex items-center gap-1"
          title="Same-device sync (other tabs/windows of this browser)"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${DOT[local.state]}`} />
          Local
        </span>
      )}
      {cloud && (
        <span className="inline-flex items-center gap-1" title={CLOUD_TITLE[cloud.state]}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${DOT[cloud.state]} ${
              cloud.state === 'error' ? 'animate-pulse' : ''
            }`}
          />
          Cloud
        </span>
      )}
    </span>
  );
}
