'use client';

import type { Scenario } from '@/lib/engine/types';
import { ActionListEditor } from '../ActionListEditor';
import { RubricEditor } from '../RubricEditor';

/** Expected actions and the rubric that scores them — they cross-reference
 *  each other (rubric categories are sets of action ids), so they edit
 *  together. */
export function AssessmentSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Expected actions ({scenario.expectedActions.length})
        </h2>
        <ActionListEditor
          actions={scenario.expectedActions}
          phases={scenario.phases}
          rubric={scenario.rubric}
          events={scenario.events}
          onChange={(expectedActions) => update({ expectedActions })}
        />
      </section>
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Rubric ({scenario.rubric.length} categories)
        </h2>
        <RubricEditor
          rubric={scenario.rubric}
          actions={scenario.expectedActions}
          onChange={(rubric) => update({ rubric })}
        />
      </section>
    </div>
  );
}
