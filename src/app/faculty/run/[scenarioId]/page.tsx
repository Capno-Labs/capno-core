'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { CopilotPanel } from '@/components/controller/CopilotPanel';
import { FlowPanel } from '@/components/controller/FlowPanel';
import { LogPanel } from '@/components/controller/LogPanel';
import { NotesPanel } from '@/components/controller/NotesPanel';
import { PatientCard } from '@/components/controller/PatientCard';
import { PhasePanel } from '@/components/controller/PhasePanel';
import { PreStartPanel } from '@/components/controller/PreStartPanel';
import { SessionControls } from '@/components/controller/SessionControls';
import { VitalControls } from '@/components/controller/VitalControls';
import { MonitorDisplay } from '@/components/monitor/MonitorDisplay';
import { nextUnfiredEvent } from '@/lib/engine/flow';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { getScenario } from '@/lib/scenarios';
import { useControllerStore } from '@/lib/store/controllerStore';

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/**
 * Faculty controller for a live session. A sticky command bar (title, clock,
 * phase, session controls) sits over a two-column cockpit: live monitor
 * preview + session/phase/vitals on the left, the case flow (events with
 * their linked learner actions) + notes/log on the right; stacks on narrow
 * screens (iPad portrait).
 */
export default function FacultyRunPage() {
  const params = useParams<{ scenarioId: string }>();
  const { engine, snapshot, loadScenario, teardown, setAlarmsSilenced, start, pause, triggerEvent } =
    useControllerStore();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const scenario = getScenario(params.scenarioId);
    if (!scenario) {
      setNotFound(true);
      return;
    }
    loadScenario(scenario);
    return () => teardown();
  }, [params.scenarioId, loadScenario, teardown]);

  useBeforeUnload(snapshot?.status === 'running' || snapshot?.status === 'paused');

  // Space = start/pause; N = fire the next event in narrative order. N is
  // the only event-firing key, it always matches the Flow panel's visible
  // "Next up" highlight, and the hook already guards against key repeat and
  // focused inputs — a grid of number keys would be a stray-keypress hazard,
  // one deliberate key is a pacing tool.
  useKeyboardShortcuts(
    {
      ' ': () => (snapshot?.status === 'running' ? pause() : start()),
      n: () => {
        if (!engine || !snapshot) return;
        const next = nextUnfiredEvent(engine.scenario.events, new Set(snapshot.firedEventIds));
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

  const currentPhaseLabel = engine.scenario.phases.find((p) => p.id === snapshot.phaseId)?.label;

  return (
    <FacultyGate>
      <main className="mx-auto max-w-[1600px] space-y-3 p-3 md:p-4 !pt-0">
        {/* Sticky command bar: title, clock, phase, and session controls stay
            visible while faculty scroll the panels. Kept to one compact row
            so the monitor preview survives on an iPad. */}
        <div className="sticky top-0 z-20 -mx-3 space-y-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur md:-mx-4 md:px-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <div className="min-w-0">
                <Link href="/scenarios" className="text-xs text-slate-500 hover:text-slate-300">
                  ← library
                </Link>
                <h1 className="truncate text-xl font-bold">{engine.scenario.title}</h1>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono text-xl font-bold tabular-nums text-slate-200">
                  {fmtClock(snapshot.elapsedSec)}
                </span>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {snapshot.status}
                  {currentPhaseLabel && (
                    <span className="text-sky-400"> · {currentPhaseLabel}</span>
                  )}
                </p>
              </div>
            </div>
            <SessionControls />
          </header>
        </div>

        <PreStartPanel />

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Left column: monitor preview + primary controls */}
          <div className="space-y-3">
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
            <PatientCard patient={engine.scenario.patient} />
            <PhasePanel />
            <VitalControls />
          </div>

          {/* Right column: case flow (events + linked actions), notes, log */}
          <div className="space-y-3">
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
