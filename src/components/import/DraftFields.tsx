'use client';

import { SECTIONS } from '@/components/editor/sections';
import type { DraftField, DraftFields as Fields } from '@/lib/import';
import { FieldRow } from './FieldRow';
import { FIELD_SPECS, ITEM_LISTS, getField, setField } from './fieldRegistry';
import { ItemList } from './ItemList';

/** Right column: every draft field, grouped the way the case editor is. */
export function DraftFields({
  fields,
  onChange,
  onFocusBlock,
}: {
  fields: Fields;
  onChange: (next: Fields) => void;
  onFocusBlock: (blockId: string | null) => void;
}) {
  return (
    <div className="space-y-5">
      {SECTIONS.map((section) => {
        const specs = FIELD_SPECS.filter((s) => s.section === section.id);
        const lists = ITEM_LISTS.filter((l) => l.section === section.id);
        return (
          <section key={section.id} className="card space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{section.label}</h3>
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
