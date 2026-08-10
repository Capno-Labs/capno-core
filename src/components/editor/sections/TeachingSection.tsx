'use client';

import type { Scenario } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';

export function TeachingSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Teaching content
        </h2>
        <ListEditor label="Learning objectives" items={scenario.learningObjectives} onChange={(learningObjectives) => update({ learningObjectives })} />
        <ListEditor label="Setup" items={scenario.setup} onChange={(setup) => update({ setup })} />
        <ListEditor label="Expected progression" items={scenario.expectedProgression} onChange={(expectedProgression) => update({ expectedProgression })} />
        <ListEditor label="Correct management" items={scenario.correctManagement} onChange={(correctManagement) => update({ correctManagement })} />
        <ListEditor label="Common errors" items={scenario.commonErrors} onChange={(commonErrors) => update({ commonErrors })} />
      </section>
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Debrief</h2>
        <ListEditor label="Debrief points" items={scenario.debrief.points} onChange={(points) => update({ debrief: { ...scenario.debrief, points } })} />
        <ListEditor label="Debrief questions" items={scenario.debrief.questions} onChange={(questions) => update({ debrief: { ...scenario.debrief, questions } })} />
      </section>
    </div>
  );
}
