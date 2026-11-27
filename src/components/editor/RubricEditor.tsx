'use client';

import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import type { ExpectedAction, RubricCategory } from '@/lib/engine/types';
import { idFromLabel } from '@/lib/scenarios/progression';

/**
 * Rubric categories: named groups of expected actions, for programs that
 * report scores by category. Membership is a checkbox list over the case's
 * actions, so the form cannot link an action that does not exist; a link
 * left behind by a JSON edit shows in red with an unlink button.
 *
 * Authors never type a category's id. A new category's id follows its name
 * until the case is saved (`fresh`), then stays as it is.
 */
export function RubricEditor({
  rubric,
  actions,
  fresh,
  onChange,
}: {
  rubric: RubricCategory[];
  actions: ExpectedAction[];
  /** Ids of categories added since the last save. */
  fresh: Set<string>;
  onChange: (rubric: RubricCategory[]) => void;
}) {
  const patch = (i: number, p: Partial<RubricCategory>) =>
    onChange(rubric.map((c, j) => (j === i ? { ...c, ...p } : c)));

  const otherIds = (i: number) => rubric.filter((_, j) => j !== i).map((c) => c.id);

  const setLabel = (i: number, label: string) => {
    const category = rubric[i];
    if (!fresh.has(category.id)) return patch(i, { label });
    const id = idFromLabel(label, otherIds(i), 'category');
    fresh.delete(category.id);
    fresh.add(id);
    patch(i, { label, id });
  };

  const add = () => {
    const id = idFromLabel('', rubric.map((c) => c.id), 'category');
    fresh.add(id);
    onChange([...rubric, { id, label: '', actionIds: [] }]);
  };

  const actionById = new Map(actions.map((a) => [a.id, a]));

  return (
    <div className="space-y-2">
      {rubric.map((category, i) => {
        const staleIds = category.actionIds.filter((id) => !actionById.has(id));
        const points = category.actionIds.reduce((sum, id) => sum + (actionById.get(id)?.points ?? 0), 0);
        return (
          <div key={i} id={`rubric-${i}`} className="scroll-mt-40 space-y-2 rounded-ctl bg-panel-2 p-3">
            <div className="flex items-end gap-2">
              <Field className="min-w-0 flex-1" label="Category name">
                <input
                  className="input"
                  value={category.label}
                  placeholder="For example: Recognition"
                  onChange={(e) => setLabel(i, e.target.value)}
                />
              </Field>
              <button
                type="button"
                className="btn-ghost btn-icon shrink-0 text-red"
                onClick={() => onChange(rubric.filter((_, j) => j !== i))}
                aria-label={`Remove category ${category.label || i + 1}`}
                title="Remove this category"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            <fieldset className="min-w-0">
              <legend className="label">
                Actions in this category · {points} point{points === 1 ? '' : 's'}
              </legend>
              <ul className="space-y-1">
                {actions.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={category.actionIds.includes(a.id)}
                        onChange={(e) =>
                          patch(i, {
                            actionIds: e.target.checked
                              ? [...category.actionIds, a.id]
                              : category.actionIds.filter((id) => id !== a.id),
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        {a.label || 'Untitled action'}{' '}
                        {a.critical && <Pill tone="red">Critical</Pill>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-faint">
                        {a.points} pt{a.points === 1 ? '' : 's'}
                      </span>
                    </label>
                  </li>
                ))}
                {staleIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-sm text-red">
                    <span className="font-mono">{id}</span>
                    <span className="text-xs">no longer exists</span>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => patch(i, { actionIds: category.actionIds.filter((x) => x !== id) })}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        );
      })}
      <button type="button" className="btn-secondary btn-sm" onClick={add}>
        <Icon name="plus" size={14} /> Add a category
      </button>
    </div>
  );
}
