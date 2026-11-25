'use client';

import { Disclosure } from '@/components/ui/Disclosure';
import { Field } from '@/components/ui/Field';
import type { Scenario } from '@/lib/engine/types';
import { RubricEditor } from '../RubricEditor';

/**
 * The parts of a case most authors never open, kept behind "Review &
 * publish": scoring (rubric categories over the expected actions) and the
 * case's identity (ID, version label).
 */
export function ReviewExtras({
  scenario,
  update,
  saved,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
  /** The case has been saved at least once, so its ID is in use. */
  saved: boolean;
}) {
  const points = scenario.expectedActions.reduce((sum, a) => sum + a.points, 0);
  return (
    <section className="card space-y-3">
      <Disclosure
        title="Scoring"
        summary={`${scenario.rubric.length} categor${scenario.rubric.length === 1 ? 'y' : 'ies'} · ${points} point${points === 1 ? '' : 's'}`}
      >
        <p className="text-xs text-faint">
          Optional. Group expected actions into rubric categories if you report scores; each
          action’s points are set beside it in Progression.
        </p>
        <RubricEditor
          rubric={scenario.rubric}
          actions={scenario.expectedActions}
          onChange={(rubric) => update({ rubric })}
        />
      </Disclosure>
      <Disclosure title="Advanced" summary={`ID ${scenario.id}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Case ID"
            hint={
              saved
                ? 'Lowercase letters, numbers and dashes. Changing it saves this case as a separate one; the original keeps its history.'
                : 'Created from the title when you first save. Lowercase letters, numbers and dashes.'
            }
          >
            <input className="input font-mono" value={scenario.id} onChange={(e) => update({ id: e.target.value })} />
          </Field>
          <Field label="Version label" hint="Your own numbering, for example 1.2.0.">
            <input className="input font-mono" value={scenario.version} onChange={(e) => update({ version: e.target.value })} />
          </Field>
        </div>
      </Disclosure>
    </section>
  );
}
