'use client';

import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { SyncHealthBadge } from '@/components/SyncHealthBadge';
import { joinUrl } from '@/components/controller/JoinLink';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/store/toastStore';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Start / pause / reset / end controls plus the session code for students.
 * Elapsed time lives in the run page's sticky command bar, not here.
 */
export function SessionControls() {
  const router = useRouter();
  const {
    snapshot,
    sessionId,
    sessionCode,
    syncHealth,
    start,
    pause,
    reset,
    endAndArchive,
    skipAhead,
    setAutoEvents,
  } = useControllerStore();
  if (!snapshot) return null;

  const status = snapshot.status;

  const handleEnd = () => {
    const id = endAndArchive();
    if (id) router.push(`/debrief/${id}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-2 flex items-center gap-2.5 rounded-ctl bg-panel-2 px-3 py-1 ring-1 ring-line">
        <span className="flex flex-col text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted">
          Session
          <span>code</span>
        </span>
        <div className="flex items-center gap-2 font-mono text-xl font-bold tracking-[0.3em] text-ink">
          {sessionCode}
          {status === 'running' && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-green motion-safe:animate-pulse"
              title="Session running"
            />
          )}
          {status === 'paused' && (
            <span className="h-1.5 w-1.5 rounded-full bg-warn" title="Session paused" />
          )}
        </div>
        <SyncHealthBadge health={syncHealth} />
        <div className="flex gap-1">
          <button
            className="rounded-ctl px-1.5 py-1 text-[11px] text-ink-2 ring-1 ring-line-2 hover:bg-panel-3"
            title="Copy session code"
            onClick={async () =>
              (await copyText(sessionCode))
                ? toast('Code copied', 'success')
                : toast('Copy failed', 'error')
            }
          >
            ⧉ code
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-ctl px-1.5 py-1 text-[11px] text-ink-2 ring-1 ring-line-2 hover:bg-panel-3"
            title="Copy a link that joins the student display directly"
            onClick={async () =>
              (await copyText(joinUrl(sessionCode)))
                ? toast('Join link copied', 'success')
                : toast('Copy failed', 'error')
            }
          >
            <Icon name="link" size={12} /> link
          </button>
        </div>
      </div>

      {status !== 'running' && status !== 'ended' && (
        <button className="btn-primary px-5 text-base" onClick={start} data-tour="start">
          ▶ {status === 'paused' ? 'Resume' : 'Start'}
        </button>
      )}
      {status === 'running' && (
        <button className="btn-secondary" onClick={pause}>
          ⏸ Pause
        </button>
      )}

      {snapshot.autoEventsEnabled && (status === 'running' || status === 'paused') && (
        <span className="flex items-center gap-1" title="Skip uneventful scenario time">
          <button className="btn-ghost" onClick={() => skipAhead(60)}>
            +1 min
          </button>
          <button className="btn-ghost" onClick={() => skipAhead(300)}>
            +5 min
          </button>
        </span>
      )}

      {status !== 'ended' && (
        <button
          className={`rounded-ctl px-2 py-1 text-xs font-semibold ring-1 ${
            snapshot.autoEventsEnabled
              ? 'bg-brand-soft text-brand-strong ring-brand/30'
              : 'bg-panel-2 text-muted ring-line hover:bg-panel-3'
          }`}
          aria-pressed={snapshot.autoEventsEnabled}
          title={
            snapshot.autoEventsEnabled
              ? 'Scripted deteriorations fire on their authored timeline'
              : 'Nothing fires on its own — you press every event'
          }
          onClick={() => setAutoEvents(!snapshot.autoEventsEnabled)}
        >
          Auto events: {snapshot.autoEventsEnabled ? 'on' : 'off'}
        </button>
      )}

      <ConfirmButton
        label="↺ Reset"
        confirmLabel="Confirm reset"
        onConfirm={reset}
        disabled={status === 'idle'}
      />

      {status !== 'ended' && (
        // Wrapper span carries the tour anchor — ConfirmButton is shared UI.
        <span data-tour="end">
          <ConfirmButton
            label="■ End session"
            confirmLabel="Confirm end → debrief"
            onConfirm={handleEnd}
            className="btn-danger"
          />
        </span>
      )}
      {status === 'ended' && (
        <button className="btn-primary" onClick={() => router.push(`/debrief/${sessionId}`)}>
          Open debrief →
        </button>
      )}
    </div>
  );
}
