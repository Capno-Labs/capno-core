'use client';

import { useRouter } from 'next/navigation';
import { SyncHealthBadge } from '@/components/SyncHealthBadge';
import { joinUrl } from '@/components/controller/JoinLink';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/store/toastStore';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Start / pause / reset / end controls plus the session code for students.
 * Elapsed time, status, and phase live in the run page's sticky command bar,
 * not here.
 */
export function SessionControls() {
  const router = useRouter();
  const { snapshot, sessionId, syncHealth, start, pause, reset, endAndArchive, skipAhead } =
    useControllerStore();
  if (!snapshot) return null;

  const status = snapshot.status;

  const handleEnd = () => {
    const id = endAndArchive();
    if (id) router.push(`/debrief/${id}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-2 flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 ring-1 ring-slate-700">
        <div>
          <span className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-400">
            Session code
            <SyncHealthBadge health={syncHealth} />
          </span>
          <div className="flex items-center gap-2 font-mono text-xl font-bold tracking-[0.3em] text-vital-ecg">
            {sessionId}
            {status === 'running' && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-vital-ecg motion-safe:animate-pulse"
                title="Session running"
              />
            )}
            {status === 'paused' && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Session paused" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            className="rounded px-1.5 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-600 hover:bg-slate-700"
            title="Copy session code"
            onClick={async () =>
              (await copyText(sessionId))
                ? toast('Code copied', 'success')
                : toast('Copy failed', 'error')
            }
          >
            ⧉ code
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-600 hover:bg-slate-700"
            title="Copy a link that joins the student display directly"
            onClick={async () =>
              (await copyText(joinUrl(sessionId)))
                ? toast('Join link copied', 'success')
                : toast('Copy failed', 'error')
            }
          >
            🔗 link
          </button>
        </div>
      </div>

      {status !== 'running' && status !== 'ended' && (
        <button className="btn-primary" onClick={start}>
          ▶ {status === 'paused' ? 'Resume' : 'Start'}
        </button>
      )}
      {status === 'running' && (
        <button className="btn-secondary" onClick={pause}>
          ⏸ Pause
        </button>
      )}

      {(status === 'running' || status === 'paused') && (
        <span className="flex items-center gap-1" title="Skip uneventful scenario time">
          <button className="btn-ghost" onClick={() => skipAhead(60)}>
            +1 min
          </button>
          <button className="btn-ghost" onClick={() => skipAhead(300)}>
            +5 min
          </button>
        </span>
      )}

      <ConfirmButton
        label="↺ Reset"
        confirmLabel="Confirm reset"
        onConfirm={reset}
        disabled={status === 'idle'}
      />

      {status !== 'ended' && (
        <ConfirmButton
          label="■ End session"
          confirmLabel="Confirm end → debrief"
          onConfirm={handleEnd}
          className="btn-danger"
        />
      )}
      {status === 'ended' && (
        <button className="btn-primary" onClick={() => router.push(`/debrief/${sessionId}`)}>
          Open debrief →
        </button>
      )}
    </div>
  );
}
