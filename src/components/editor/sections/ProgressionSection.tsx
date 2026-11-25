'use client';

import type { LintWarning } from '@/lib/engine/lint';
import type { Scenario } from '@/lib/engine/types';
import { ActionListEditor } from '../ActionListEditor';
import { EventListEditor } from '../EventListEditor';
import { ListEditor } from '../ListEditor';
import { PhaseListEditor } from '../PhaseListEditor';
import { SectionCard, SectionHead } from './SectionHead';

/**
 * What happens during the case: its phases, the changes that occur in them,
 * what learners are expected to do, and the faculty's notes on how it should
 * go. Events point at phases and actions, so they are edited on one page.
 */
export function ProgressionSection({
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
      <SectionHead title="Progression">
        What happens, in order: the phases of the case, the changes in each one, and what learners
        are expected to do about them.
      </SectionHead>
      <SectionCard title={`Phases (${scenario.phases.length})`}>
        <PhaseListEditor phases={scenario.phases} onChange={(phases) => update({ phases })} />
      </SectionCard>
      <SectionCard title={`What happens (${scenario.events.length})`}>
        <EventListEditor
          events={scenario.events}
          phases={scenario.phases}
          actions={scenario.expectedActions}
          baselineVitals={scenario.baselineVitals}
          estimatedMinutes={scenario.estimatedMinutes}
          warnings={warnings}
          onChange={(events) => update({ events })}
        />
      </SectionCard>
      <SectionCard title={`Learners should (${scenario.expectedActions.length})`}>
        <ActionListEditor
          actions={scenario.expectedActions}
          phases={scenario.phases}
          rubric={scenario.rubric}
          events={scenario.events}
          onChange={(expectedActions) => update({ expectedActions })}
        />
      </SectionCard>
      <SectionCard title="Faculty notes" hint="For whoever runs the case. Learners do not see these.">
        <ListEditor
          label="Expected progression"
          items={scenario.expectedProgression}
          onChange={(expectedProgression) => update({ expectedProgression })}
          placeholder="Add a step…"
        />
        <ListEditor
          label="Correct management"
          items={scenario.correctManagement}
          onChange={(correctManagement) => update({ correctManagement })}
          placeholder="Add a step…"
        />
        <ListEditor
          label="Common errors"
          items={scenario.commonErrors}
          onChange={(commonErrors) => update({ commonErrors })}
          placeholder="Add an error…"
          ordered={false}
        />
      </SectionCard>
    </div>
  );
}
