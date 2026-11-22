'use client';

import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { CopilotPanel } from '@/components/controller/CopilotPanel';
import { FlowPanel } from '@/components/controller/FlowPanel';
import { PhaseStepper } from '@/components/controller/PhaseStepper';
import { PreStartPanel } from '@/components/controller/PreStartPanel';
import { RunDock } from '@/components/controller/RunDock';
import { SessionControls } from '@/components/controller/SessionControls';
import { VitalControls } from '@/components/controller/VitalControls';
import { MonitorDisplay } from '@/components/monitor/MonitorDisplay';
import { SyncPill } from '@/components/shell/SyncPill';
import { DemoTour } from '@/components/tour/DemoTour';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { hasSeenDemo } from '@/lib/demoTour';
import { nextUnfiredEvent, sessionPace } from '@/lib/engine/flow';
import { formatClock } from '@/lib/format';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { getScenario } from '@/lib/scenarios';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Faculty controller for a live session. A command bar (title, clock,
 * session controls, phase stepper) sits over the cockpit. Up to `desk` the
 * cockpit is two columns (monitor preview + physiology on the left, case
 * flow + the notes/log/patient dock on the right — iPad landscape keeps this
 * layout); at `desk` it becomes a three-zone cockpit: case-flow rail,
 * monitor with the dock beneath, and a physiology rail. Below `lg` (iPad
 * portrait) everything collapses to a single monitor-first stack.
 *
 * When the window has room (the `fit` variants in tailwind.config.ts) the
 * cockpit fills the viewport (the shell's top bar steps aside) and each
 * zone scrolls on its own, so the monitor and the next event stay on screen;
 * otherwise the page scrolls and the command bar sticks.
 */
export default function FacultyRunPage() {
  const params = useParams<{ scenarioId: string }>();
  const {
    engine,
    snapshot,
    loadScenario,
    teardown,
    setAlarmsSilenced,
    acknowledgeAlarms,
    stepAlarmLimit,
    setAlarmOff,
    start,
    pause,
    triggerEvent,
  } = useControllerStore();
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-ink-2">Scenario “{params.scenarioId}” not found.</p>
        <Link href="/scenarios" className="btn-primary">
          Back to library
        </Link>
      </div>
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

  // Pace against the lab slot (authored budget, else the library estimate).
  const pace = sessionPace(engine.scenario, snapshot.elapsedSec);
  const hardBudget = engine.scenario.targetDurationSec !== undefined;
  const paceLive = snapshot.status === 'running' || snapshot.status === 'paused';

  return (
    <FacultyGate>
      <div className="space-y-3 fit:flex fit:min-h-0 fit:flex-1 fit:flex-col">
        {/* Command bar: title, clock, and session controls. Sticky while the
            page scrolls; in the viewport-fit cockpit nothing scrolls past it.
            Kept compact so the monitor preview keeps its height on iPad
            (still fully supported, just no longer the primary device). */}
        <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 space-y-2 border-b border-line bg-surface px-4 py-2 md:-mx-7 md:px-7 fit:static fit:shrink-0">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-brand-strong">
                  Live session
                </div>
                <h1 className="truncate text-xl font-bold tracking-[-0.02em]">
                  {engine.scenario.title}
                </h1>
              </div>
              <span className="shrink-0 font-mono text-3xl font-bold tabular-nums text-ink">
                {formatClock(snapshot.elapsedSec)}
              </span>
              {paceLive && (
                <span
                  className={`shrink-0 self-center rounded-ctl px-2 py-1 font-mono text-xs font-semibold tabular-nums ring-1 ${
                    pace.state === 'over'
                      ? 'bg-warn-soft text-warn-strong ring-warn/40'
                      : pace.state === 'low'
                        ? 'bg-panel-2 text-warn-strong ring-warn/40'
                        : 'bg-panel-2 text-muted ring-line'
                  }`}
                  title={`${hardBudget ? 'Lab slot budget' : 'Estimated run time'}: ${formatClock(pace.budgetSec)}`}
                >
                  {pace.state === 'over'
                    ? `+${formatClock(pace.overBySec)} over`
                    : `${formatClock(pace.remainingSec)} left`}
                </span>
              )}
              {imminentAuto && (
                <span
                  className="shrink-0 self-center rounded-ctl bg-warn-soft px-2 py-1 text-xs font-semibold text-warn-strong ring-1 ring-warn/40 motion-safe:animate-pulse"
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
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <PhaseStepper />
            </div>
            {/* The viewport-fit cockpit hides the shell's top bar to give its
                height to the monitor; its sync pill and theme toggle ride
                here instead. */}
            <span className="hidden shrink-0 items-center gap-2 fit:flex">
              <SyncPill />
              <ThemeToggle />
            </span>
          </div>
        </div>

        {tourOpen && <DemoTour onClose={() => setTourOpen(false)} />}

        <PreStartPanel />

        {/* Cockpit grid. Below `desk` this is the proven two-column layout
            (iPad landscape stays two columns — see tailwind.config.ts); at
            `desk` the wrappers dissolve (display: contents) into the
            three-zone cockpit: case-flow rail | monitor + dock | physiology
            rail. Every zone needs min-w-0 so waveforms and truncated text can
            shrink inside grid tracks.

            Row 2 is flexible at `desk` so the rails (which span both rows)
            stretch it rather than row 1 — otherwise a gap opens between the
            monitor and the dock.

            Viewport fit: the grid takes the height left under the command
            bar. At `fit3` row 1 is the monitor's own height and row 2 (the
            dock) takes the rest; the rails span both and scroll. At `fit2`
            each column is a flex stack (the dock keeps a fixed height there,
            so the Flow gets the room). The grid's own overflow is a safety
            valve for when the monitor grows a tile row mid-session.

            The `fit*` variants sort before the screen variants, so a fit
            utility that must override `md:`/`desk:` on the same element is
            written stacked (`desk:fit3:…`). */}
        <div className="grid gap-3 lg:grid-cols-2 desk:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.6fr)_minmax(340px,0.8fr)] desk:grid-rows-[auto_1fr] fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit2:grid-rows-[minmax(0,1fr)] desk:fit3:grid-rows-[auto_minmax(108px,1fr)]">
          {/* lg left column (first in DOM so the single-column stack leads
              with the monitor): preview + physiology controls. */}
          <div className="min-w-0 space-y-3 desk:space-y-0 desk:contents fit2:flex fit2:min-h-0 fit2:flex-col">
            {/* The frame keeps the monitor's natural height (no explicit
                height: the alarm-setup overlay and the monitor's own h-full
                size against it). */}
            <div className="min-w-0 desk:col-start-2 desk:row-start-1 fit2:shrink-0">
              <div className="overflow-hidden rounded-xl ring-1 ring-line">
                <div className="flex items-center justify-between bg-panel px-3 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-faint">
                    Live monitor (what students see)
                  </span>
                  <button
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                    onClick={() => setAlarmsSilenced(!snapshot.alarmsSilenced)}
                  >
                    <Icon name={snapshot.alarmsSilenced ? 'bell-off' : 'bell'} size={13} />
                    {snapshot.alarmsSilenced ? 'alarms paused' : 'pause all alarms'}
                  </button>
                </div>
                <MonitorDisplay
                  snapshot={snapshot}
                  compact
                  alarmSetup={{ stepLimit: stepAlarmLimit, setOff: setAlarmOff, silence: acknowledgeAlarms }}
                />
              </div>
            </div>
            {/* Physiology rail. The 1px padding keeps the cards' rings from
                being clipped by the rail's own scroll box. */}
            <div
              className="min-w-0 space-y-3 desk:col-start-3 desk:row-start-1 desk:row-span-2 desk:self-start fit:overflow-y-auto fit:overscroll-contain fit:p-px fit2:min-h-0 fit2:flex-1 fit3:min-h-0 desk:fit3:self-stretch"
              data-tour="vitals"
            >
              <VitalControls />
              <CopilotPanel />
            </div>
          </div>

          {/* lg right column: case flow (events + linked actions), then the
              notes/log/patient dock (which sits under the monitor at desk). */}
          <div className="min-w-0 space-y-3 desk:space-y-0 desk:contents fit2:flex fit2:min-h-0 fit2:flex-col">
            <div className="min-w-0 desk:col-start-1 desk:row-start-1 desk:row-span-2 desk:self-start fit2:min-h-0 fit2:flex-1 fit3:min-h-0 desk:fit3:self-stretch">
              <FlowPanel />
            </div>
            <div className="min-w-0 desk:col-start-2 desk:row-start-2 desk:self-start fit2:h-56 fit2:shrink-0 fit3:min-h-0 desk:fit3:self-stretch">
              <RunDock />
            </div>
          </div>
        </div>
      </div>
    </FacultyGate>
  );
}
