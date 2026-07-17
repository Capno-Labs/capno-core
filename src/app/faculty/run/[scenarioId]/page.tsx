'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { CopilotPanel } from '@/components/controller/CopilotPanel';
import { FlowPanel } from '@/components/controller/FlowPanel';
import { LogPanel } from '@/components/controller/LogPanel';
import { NotesPanel } from '@/components/controller/NotesPanel';
import { PatientCard } from '@/components/controller/PatientCard';
import { PreStartPanel } from '@/components/controller/PreStartPanel';
import { SessionControls } from '@/components/controller/SessionControls';
import { VitalControls } from '@/components/controller/VitalControls';
import { MonitorDisplay } from '@/components/monitor/MonitorDisplay';
import { DemoTour } from '@/components/tour/DemoTour';
import { hasSeenDemo } from '@/lib/demoTour';
import { nextUnfiredEvent } from '@/lib/engine/flow';
import { formatClock } from '@/lib/format';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { getScenario } from '@/lib/scenarios';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Faculty controller for a live session. A sticky command bar (title, clock,
 * session controls) sits over the cockpit. The cockpit is two zones:
 * live monitor preview + vital controls + patient background on the left,
 * and the case flow (events with their linked learner actions) + notes/log
 * in a right rail. At the `desk` breakpoint the right rail is width-capped
 * so the monitor keeps its size; below `lg` (iPad portrait) the zones
 * collapse to a single monitor-first stack.
 */
export default function FacultyRunPage() {
  const params = useParams<{ scenarioId: string }>();
  const { engine, snapshot, loadScenario, teardown, setAlarmsSilenced, start, pause, triggerEvent } =
    useControllerStore();
  const [notFound, setNotFound] = useState(false);
  // ?code=XXXX from the "Run next student" turnover, read exactly once per
  // page instance (null = read, none present). The ref keeps the load effect
  // idempotent under StrictMode's double-invocation.
  const turnoverCode = useRef<string | null | undefined>(undefined);
  // ?demo=1 from the homepage CTA, consumed in the same one-shot read.
  const demoFlag = useRef(false);
  const [demoRequested, setDemoRequested] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const scenario = getScenario(params.scenarioId);
    if (!scenario) {
      setNotFound(true);
      return;
    }
    // The turnover code reuses the previous session's sync channel so
    // connected student displays pick the new run up without re-joining.
    // It is one-shot state, not addressable state: strip it from the URL
    // immediately after consumption so a duplicated tab, refresh, or
    // history/bookmark revisit can't spin up a second controller on a
    // channel that is live elsewhere (one authority per session).
    if (turnoverCode.current === undefined) {
      const search = new URLSearchParams(window.location.search);
      turnoverCode.current = search.get('code');
      demoFlag.current = search.get('demo') !== null;
      if (turnoverCode.current || demoFlag.current) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    if (demoFlag.current) {
      setDemoRequested(true);
      // Self-open only on first sight; returning users get the Restart button.
      if (!hasSeenDemo()) setTourOpen(true);
    }
    loadScenario(scenario, turnoverCode.current ?? undefined);
    return () => teardown();
  }, [params.scenarioId, loadScenario, teardown]);

  useBeforeUnload(snapshot?.status === 'running' || snapshot?.status === 'paused');

  // Space = start/pause; N = fire the next event in narrative order (or the
  // instructor's pinned "make next" override, when one is set). N is
  // the only event-firing key, it always matches the Flow panel's visible
  // "Next up" highlight (the panel pins that card even when a filter would
  // hide it), it only works while the session is live, and the hook guards
  // against key repeat and focused inputs — a grid of number keys would be
  // a stray-keypress hazard, one deliberate key is a pacing tool.
  useKeyboardShortcuts(
    {
      ' ': () => (snapshot?.status === 'running' ? pause() : start()),
      n: () => {
        if (!engine || !snapshot) return;
        if (snapshot.status !== 'running' && snapshot.status !== 'paused') return;
        const next = nextUnfiredEvent(
          engine.getEvents(),
          new Set(snapshot.firedEventIds),
          engine.getPinnedNextEventId(),
        );
        if (next) triggerEvent(next.id);
      },
    },
    !!snapshot && snapshot.status !== 'ended',
  );

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-300">Scenario “{params.scenarioId}” not found.</p>
        <Link href="/scenarios" className="btn-primary">
          Back to library
        </Link>
      </main>
    );
  }

  if (!engine || !snapshot) return null;

  // The old script rail flashed imminent autos in the sticky bar; keep that
  // safety net when auto events are on and the Flow panel may be scrolled away.
  const imminentAuto =
    snapshot.autoEventsEnabled && snapshot.status === 'running'
      ? engine
          .getEvents()
          .filter((e) => e.autoAtSec !== undefined && !snapshot.firedEventIds.includes(e.id))
          .map((e) => ({ label: e.label, remaining: e.autoAtSec! - snapshot.elapsedSec }))
          .filter((x) => x.remaining > 0 && x.remaining <= 30)
          .sort((a, b) => a.remaining - b.remaining)[0]
      : undefined;

  return (
    <FacultyGate>
      <main className="mx-auto max-w-[1600px] space-y-3 p-3 md:p-4 !pt-0">
        {/* Sticky command bar: title, clock, and session controls stay
            visible while faculty scroll the panels. Kept to one compact row
            so the monitor preview keeps its height on iPad (still fully
            supported, just no longer the primary device). */}
        <div className="sticky top-0 z-20 -mx-3 space-y-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur md:-mx-4 md:px-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <div className="min-w-0">
                <Link href="/scenarios" className="text-xs text-slate-500 hover:text-slate-300">
                  ← library
                </Link>
                <h1 className="truncate text-xl font-bold">{engine.scenario.title}</h1>
              </div>
              <span className="shrink-0 font-mono text-3xl font-bold tabular-nums text-white">
                {formatClock(snapshot.elapsedSec)}
              </span>
              {imminentAuto && (
                <span
                  className="shrink-0 self-center rounded bg-amber-950/80 px-2 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-600 motion-safe:animate-pulse"
                  title="Scripted event about to fire automatically"
                >
                  ⏱ {imminentAuto.label} · {formatClock(imminentAuto.remaining)}
                </span>
              )}
            </div>
            <span className="flex flex-wrap items-center gap-2">
              {demoRequested && !tourOpen && (
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setTourOpen(true)}
                  title="Replay the guided walkthrough"
                >
                  ↻ Restart tour
                </button>
              )}
              <SessionControls />
            </span>
          </header>
        </div>

        {tourOpen && <DemoTour onClose={() => setTourOpen(false)} />}

        <PreStartPanel />

        {/* Cockpit grid. Both zones need min-w-0 so waveforms and truncated
            text can shrink inside grid tracks. */}
        <div className="grid gap-3 lg:grid-cols-2 desk:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
          {/* Left zone (first in DOM so the single-column stack leads with
              the monitor): preview + physiology controls + patient. */}
          <div className="min-w-0 space-y-3">
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-800">
              <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Live monitor (what students see)
                </span>
                <button
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setAlarmsSilenced(!snapshot.alarmsSilenced)}
                >
                  {snapshot.alarmsSilenced ? '🔕 alarms silenced' : '🔔 silence alarms'}
                </button>
              </div>
              <MonitorDisplay snapshot={snapshot} compact />
            </div>
            <VitalControls />
            <PatientCard patient={engine.scenario.patient} />
          </div>

          {/* Right rail: case flow (events + linked actions), notes, log. */}
          <div className="min-w-0 space-y-3">
            <CopilotPanel />
            <FlowPanel />
            <NotesPanel />
            <LogPanel />
          </div>
        </div>
      </main>
    </FacultyGate>
  );
}
