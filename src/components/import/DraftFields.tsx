'use client';

import { VITAL_NAMES } from '@/components/editor/fieldLabels';
import type { ExpectedAction, NumericVitals, Phase } from '@/lib/engine/types';
import { DEFAULT_VITALS } from '@/lib/engine/vitals';
import type { DraftField, DraftFields as Fields } from '@/lib/import';
import { FieldRow } from './FieldRow';
import { FIELD_SPECS, ITEM_LISTS, SECTIONS, getField, setField } from './fieldRegistry';
import type { ItemContext } from './ItemForms';
import { ItemList } from './ItemList';

/** The starting numbers a run sheet most often leaves out. */
const DEFAULTABLE = Object.keys(VITAL_NAMES) as (keyof NumericVitals)[];
const DEFAULT_NOTE = 'The studio’s default for a healthy adult, not from your run sheet. Edit it if your case starts differently.';

/** Right column: every draft field, grouped the way the source document is laid out. */
export function DraftFields({
  fields,
  onChange,
  onFocusBlock,
}: {
  fields: Fields;
  onChange: (next: Fields) => void;
  onFocusBlock: (blockId: string | null) => void;
}) {
  // What the pickers inside the item forms offer: the phases and actions decided so far.
  const present = <T,>(list: DraftField<T>[]) => list.flatMap((f) => (f.value ? [f.value] : []));
  const context: ItemContext = {
    phases: present(fields.phases as DraftField<Phase>[]),
    actions: present(fields.expectedActions as DraftField<ExpectedAction>[]),
  };

  const vitals = fields.baselineVitals;
  const missing = [
    ...DEFAULTABLE.filter((key) => vitals[key].status === 'unresolved' && vitals[key].value === null),
    ...(vitals.rhythm.status === 'unresolved' && vitals.rhythm.value === null ? (['rhythm'] as const) : []),
  ];
  // One press is the reviewer's decision for all of them, so each is confirmed
  // as a faculty entry. Nothing is filled in until the button is pressed.
  const useDefaults = () => {
    let next = fields;
    for (const key of missing) {
      next = setField(next, `baselineVitals.${key}`, {
        value: DEFAULT_VITALS[key],
        status: 'confirmed',
        provenance: { method: 'faculty' },
        note: DEFAULT_NOTE,
      });
    }
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {SECTIONS.map((section) => {
        const specs = FIELD_SPECS.filter((s) => s.section === section.id);
        const lists = ITEM_LISTS.filter((l) => l.section === section.id);
        return (
          <section key={section.id} className="card space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{section.label}</h3>
            {section.id === 'vitals' && missing.length > 0 && (
              <div className="rounded-ctl bg-panel-2 p-2" data-default-vitals>
                <button type="button" className="btn-secondary btn-sm" onClick={useDefaults}>
                  Use the studio’s default adult values
                </button>
                <p className="mt-1 text-xs text-faint">
                  For the {missing.length} starting value{missing.length === 1 ? '' : 's'} the run sheet does not
                  state. One click confirms them all, and you can still edit any of them: HR {DEFAULT_VITALS.hr}, BP{' '}
                  {DEFAULT_VITALS.sbp}/{DEFAULT_VITALS.dbp}, SpO₂ {DEFAULT_VITALS.spo2}, EtCO₂ {DEFAULT_VITALS.etco2},
                  RR {DEFAULT_VITALS.rr}, {DEFAULT_VITALS.temp} °C, sinus rhythm, awake, no agent.
                </p>
              </div>
            )}
            {specs.map((spec) => (
              <FieldRow
                key={spec.path}
                spec={spec}
                field={getField(fields, spec.path)}
                onChange={(next) => onChange(setField(fields, spec.path, next))}
                onFocusBlock={onFocusBlock}
              />
            ))}
            {lists.map((l) => (
              <ItemList
                key={l.key}
                listKey={l.key}
                label={l.label}
                items={fields[l.key] as DraftField<unknown>[]}
                context={context}
                onChange={(next) => onChange({ ...fields, [l.key]: next } as Fields)}
                onFocusBlock={onFocusBlock}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
