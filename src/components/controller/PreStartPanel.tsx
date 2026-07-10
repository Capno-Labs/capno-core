'use client';

import { useState } from 'react';
import { SyncHealthBadge } from '@/components/SyncHealthBadge';
import { CopyJoinLinkButton, joinUrl } from '@/components/controller/JoinLink';
import { cloudEligible } from '@/lib/cloud/outbox';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Pre-start setup panel, shown while the session is idle: connect the
 * student display, glance over the run configuration, know where the
 * debrief will be stored. Dismissible and purely informational — it never
 * gates the Start button. It lives on the run page (not a separate route)
 * because the session code only exists once the controller has loaded the
 * scenario.
 */
export function PreStartPanel() {
  const { engine, snapshot, sessionId, syncHealth } = useControllerStore();
  const [dismissed, setDismissed] = useState(false);

  if (!engine || !snapshot || dismissed || snapshot.status !== 'idle') return null;

  const scenario = engine.scenario;
  const crossDevice = syncHealth.some((h) => h.kind === 'supabase');
  const nibpMin = Math.round((scenario.monitoring?.nibpIntervalSec ?? 180) / 60);
  const actionCount = scenario.expectedActions.length;
  const criticalCount = scenario.expectedActions.filter((a) => a.critical).length;
  // Two storage tiers exist today: local-only, or outbox pushes to the
  // institution archive (Supabase configured + signed-in faculty account).
  const storage = cloudEligible()
    ? {
        label: 'Institution archive enabled',
        detail: 'The debrief saves on this device and syncs to your institution archive.',
      }
    : {
        label: 'This device only',
        detail: 'The debrief saves in this browser. Sign in on the Account page to enable the institution archive.',
      };

  return (
    <section className="card space-y-3 ring-1 !ring-sky-800">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
          Before you start
        </h2>
        <button
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => setDismissed(true)}
        >
          Hide — I know this screen ✕
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="label">Connect the student display</h3>
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-800/60 p-3">
            <span
              className="font-mono text-3xl font-bold tracking-[0.3em] text-vital-ecg"
              title="Session code"
            >
              {sessionId}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <CopyJoinLinkButton sessionId={sessionId} />
              <button
                className="btn-secondary !py-1 text-xs"
                onClick={() => window.open(joinUrl(sessionId), '_blank', 'noopener')}
              >
                Open display ↗
              </button>
              <SyncHealthBadge health={syncHealth} />
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {crossDevice
              ? 'Cross-device sync is on — displays can join from any device with the link or code.'
              : 'Displays join from this device or another tab of this browser. Joining from a different device needs the cloud realtime backend on both sides.'}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="label">This run</h3>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>
              {scenario.monitoring?.artLine
                ? 'Arterial line — the monitor shows live blood pressure.'
                : `NIBP cuff every ${nibpMin} min — the monitor shows the last reading, not live pressure.`}
            </li>
            <li>
              Alarms {snapshot.alarmsSilenced ? 'silenced' : 'on'} — toggle on the monitor preview.
            </li>
            <li>
              {actionCount} expected learner actions ({criticalCount} critical) — mark them in the
              checklist as you observe.
            </li>
            <li>
              <span className="font-semibold text-slate-200">{storage.label}.</span>{' '}
              <span className="text-slate-400">{storage.detail}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
