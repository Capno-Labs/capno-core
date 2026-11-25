'use client';

import type { Scenario } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';
import { SectionCard, SectionHead } from './SectionHead';

export function DebriefSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHead title="Debrief">
        What the debrief walkthrough asks and what it leaves learners with.
      </SectionHead>
      <SectionCard
        title="Questions"
        hint="Asked in the debrief walkthrough, in this order."
      >
        <ListEditor
          label="Debrief questions"
          items={scenario.debrief.questions}
          onChange={(questions) => update({ debrief: { ...scenario.debrief, questions } })}
          placeholder="Add a question…"
        />
      </SectionCard>
      <SectionCard title="Key teaching points" hint="Shown in the debrief walkthrough and on the printed record.">
        <ListEditor
          label="Teaching points"
          items={scenario.debrief.points}
          onChange={(points) => update({ debrief: { ...scenario.debrief, points } })}
          placeholder="Add a teaching point…"
        />
      </SectionCard>
    </div>
  );
}
