'use client';

import { useEffect, useRef, useState } from 'react';
import { LogList } from '@/components/controller/LogPanel';
import { NotesPanel } from '@/components/controller/NotesPanel';
import { PatientDetails } from '@/components/controller/PatientCard';
import { useControllerStore } from '@/lib/store/controllerStore';

type Side = 'log' | 'patient';

const TAB =
  'border-b-2 pb-0.5 text-sm font-bold uppercase tracking-wider transition-colors duration-150';
const tabClass = (active: boolean) =>
  `${TAB} ${active ? 'border-brand text-ink' : 'border-transparent text-faint hover:text-ink-2'}`;

/**
 * The dock under the monitor preview: faculty notes, the live log and the
 * patient background. In the viewport-fit cockpit it takes whatever height
 * the monitor leaves, so the space under the preview is working space rather
 * than a gap. At `desk` Notes sits beside a Log | Patient card; narrower
 * layouts show one of the three at a time.
 *
 * The patient opens first (the pre-brief toggle asks faculty to read it) and
 * the dock turns to the notes and log when the session first runs.
 */
export function RunDock() {
  const { engine, snapshot } = useControllerStore();
  // Below `desk` only one pane fits: notes, or the side card.
  const [showNotes, setShowNotes] = useState(false);
  const [side, setSide] = useState<Side>('patient');
  const turned = useRef(false);
  const running = snapshot?.status === 'running';

  useEffect(() => {
    if (running && !turned.current) {
      turned.current = true;
      setSide('log');
      setShowNotes(true);
    }
  }, [running]);

  if (!engine || !snapshot) return null;

  const pick = (next: Side) => {
    setSide(next);
    setShowNotes(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 fit:h-full fit:min-h-0">
      {/* One-at-a-time tabs for the layouts where the panes don't sit side
          by side. NotesPanel stays mounted either way — it holds the draft. */}
      <div className="flex gap-4 px-1 desk:hidden" role="group" aria-label="Notes, log and patient">
        <button className={tabClass(showNotes)} aria-pressed={showNotes} onClick={() => setShowNotes(true)}>
          Notes
        </button>
        <button
          className={tabClass(!showNotes && side === 'log')}
          aria-pressed={!showNotes && side === 'log'}
          onClick={() => pick('log')}
        >
          Log
        </button>
        <button
          className={tabClass(!showNotes && side === 'patient')}
          aria-pressed={!showNotes && side === 'patient'}
          onClick={() => pick('patient')}
        >
          Patient
        </button>
      </div>
      <div className="grid gap-3 desk:grid-cols-2 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <NotesPanel className={showNotes ? 'flex' : 'hidden desk:flex'} />
        <section
          className={`card min-w-0 flex-col gap-2 fit:min-h-0 ${showNotes ? 'hidden desk:flex' : 'flex'}`}
        >
          <div className="hidden gap-4 desk:flex" role="group" aria-label="Log or patient">
            <button
              className={tabClass(side === 'log')}
              aria-pressed={side === 'log'}
              onClick={() => setSide('log')}
            >
              Log
            </button>
            <button
              className={tabClass(side === 'patient')}
              aria-pressed={side === 'patient'}
              onClick={() => setSide('patient')}
            >
              Patient
            </button>
          </div>
          {side === 'log' ? <LogList /> : <PatientDetails patient={engine.scenario.patient} />}
        </section>
      </div>
    </div>
  );
}
