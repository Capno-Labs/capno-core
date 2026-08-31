'use client';

import type { LintWarning } from '@/lib/engine/lint';
import type { Scenario } from '@/lib/engine/types';
import { EventListEditor } from '../EventListEditor';
import { PhaseListEditor } from '../PhaseListEditor';

/** Phases and events on one surface — instructors script a case in scenario
 *  time, and events reference phases (phase hints), so they edit together. */
export function TimelineSection({
  scenario,
  update,
  warnings,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
  warnings: LintWarning[];
}) {
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Phases ({scenario.phases.length})
        </h2>
        <PhaseListEditor phases={scenario.phases} onChange={(phases) => update({ phases })} />
      </section>
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Events ({scenario.events.length})
        </h2>
        <EventListEditor
          events={scenario.events}
          phases={scenario.phases}
          actions={scenario.expectedActions}
          baselineVitals={scenario.baselineVitals}
          estimatedMinutes={scenario.estimatedMinutes}
          warnings={warnings}
          onChange={(events) => update({ events })}
        />
      </section>
    </div>
  );
}
