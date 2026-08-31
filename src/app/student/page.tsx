'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CapnoGlyph } from '@/components/brand/CapnoGlyph';
import { BootOverlay } from '@/components/monitor/BootOverlay';
import { MonitorDisplay } from '@/components/monitor/MonitorDisplay';
import { SyncHealthBadge } from '@/components/SyncHealthBadge';
import { CodeInput } from '@/components/ui/CodeInput';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useStudentStore } from '@/lib/store/studentStore';

/**
 * Student display: join a session by code, then show the full-screen monitor.
 * Designed to run on a projector, wall display, or iPad at the head of bed.
 * A ?code=XXXX link (copied from the faculty controller) joins directly.
 */
function StudentContent() {
  const { sessionId, snapshot, phase, syncHealth, join, leave } = useStudentStore();
  const [code, setCode] = useState('');
  const search = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [booted, setBooted] = useState(false);
  const hasSnapshot = Boolean(snapshot);

  // Re-arm the power-on moment for the next join.
  useEffect(() => {
    if (!hasSnapshot) setBooted(false);
  }, [hasSnapshot]);

  // Keep the projector/iPad awake while the monitor is showing.
  useWakeLock(Boolean(snapshot));

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => () => leave(), [leave]);

  // Auto-join from the URL. Runs only when the search params change, so a
  // Cancel (store update, same params) doesn't re-trigger it — the code
  // stays prefilled in the form for manual retry.
  useEffect(() => {
    const c = search.get('code');
    if (c && c.trim().length >= 4) {
      setCode(c.toUpperCase());
      join(c);
    }
  }, [search, join]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    join(code);
  };

  if (!sessionId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#0d0f0c] ring-1 ring-[#30342b]">
            <CapnoGlyph className="h-6 w-auto text-vital-etco2" />
          </span>
          <h1 className="text-xl font-bold">Join a session</h1>
          <p className="text-sm text-muted">
            Enter the 4-character session code shown on the faculty controller.
          </p>
          <CodeInput value={code} onChange={setCode} autoFocus />
          <button type="submit" className="btn-primary w-full" disabled={code.trim().length < 4}>
            Join session
          </button>
          <Link href="/" className="block text-xs text-faint hover:text-ink-2">
            ← back to home
          </Link>
        </form>
      </main>
    );
  }

  if (phase === 'join_failed') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="card w-full max-w-sm space-y-4 text-center motion-safe:animate-shake">
          <div className="font-mono text-4xl text-red">⚠</div>
          <h1 className="text-xl font-bold">No controller responded</h1>
          <p className="text-sm text-muted">
            Nothing answered for code{' '}
            <span className="font-mono font-bold text-ink">{sessionId}</span>. Check the code
            and that the faculty controller is open. Joining from a different device requires the
            Supabase realtime backend on both sides.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={() => join(sessionId)}>
              Retry
            </button>
            <button className="btn-ghost" onClick={leave}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    if (phase === 'ended') {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="text-ink-2">Session ended by faculty.</p>
          <button className="btn-primary" onClick={leave}>
            Join another session
          </button>
        </main>
      );
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="animate-pulse">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#0d0f0c] ring-1 ring-[#30342b]">
            <CapnoGlyph className="h-6 w-auto text-vital-etco2" />
          </span>
        </div>
        <div className="flex gap-2" aria-hidden>
          {sessionId.split('').map((char, i) => (
            <div
              key={i}
              className="flex h-12 w-9 items-center justify-center rounded-lg bg-panel-2 font-mono text-2xl text-muted ring-1 ring-line"
            >
              {char}
            </div>
          ))}
        </div>
        <p className="text-muted">
          Waiting for session <span className="sr-only">{sessionId}</span>…
        </p>
        <p className="max-w-sm text-center text-xs text-faint">
          Make sure the faculty controller is open. On a different device, both machines need the
          Supabase realtime backend configured.
        </p>
        <button className="btn-ghost" onClick={leave}>
          Cancel
        </button>
      </main>
    );
  }

  return (
    <main className="relative h-screen">
      {phase === 'stale' && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-[#452020] px-3 py-1 text-xs text-[#ff9999] ring-1 ring-[#7f1d1d]">
          Connection to controller lost — showing last received data
        </div>
      )}
      {phase === 'ended' && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-monitor-panel px-3 py-1 text-xs text-[#dce3d9] ring-1 ring-monitor-grid">
          Session ended by faculty
        </div>
      )}
      {/* Cross-device sessions get a corner sync indicator; the badge is
          omitted entirely on the default same-device setup to keep the
          projector view clean. */}
      {syncHealth.some((h) => h.kind === 'supabase') && (
        <div className="absolute bottom-2 right-3 z-10">
          <SyncHealthBadge health={syncHealth} />
        </div>
      )}
      {typeof document !== 'undefined' && document.fullscreenEnabled && (
        <button
          className="absolute right-2 top-2 z-10 rounded bg-monitor-panel px-2 py-1 text-sm text-[#dce3d9] opacity-40 ring-1 ring-monitor-grid transition-opacity hover:opacity-100"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={() => {
            if (isFullscreen) void document.exitFullscreen().catch(() => {});
            else void document.documentElement.requestFullscreen().catch(() => {});
          }}
        >
          {isFullscreen ? '🡼' : '⛶'}
        </button>
      )}
      {!booted && <BootOverlay onDone={() => setBooted(true)} />}
      <MonitorDisplay snapshot={snapshot} showRhythmLabel={false} />
    </main>
  );
}

export default function StudentPage() {
  return (
    <Suspense>
      <StudentContent />
    </Suspense>
  );
}
