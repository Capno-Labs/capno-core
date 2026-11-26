'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORY_DOT, CATEGORY_LABELS } from '@/components/eventCategories';
import { Icon } from '@/components/ui/Icon';
import { downloadJson } from '@/lib/download';
import { EVENT_TEMPLATES, TEMPLATE_KINDS } from '@/lib/engine/eventTemplates';
import type { EventCategory, ScenarioEvent, VitalEffect } from '@/lib/engine/types';
import { parseLibraryFile, serializeLibraryFile, type SavedEvent } from '@/lib/scenarios/eventLibrary';
import { deleteSavedEvent, importSavedEvents, listSavedEvents } from '@/lib/scenarios/eventLibraryStore';
import { describeEvent } from '@/lib/scenarios/progression';
import { toast } from '@/lib/store/toastStore';

export type EventPreset = Pick<ScenarioEvent, 'category' | 'effects'> & Partial<ScenarioEvent>;

/**
 * Pick an event to start from: one saved to "My events" on this device, or a
 * template copied from the bundled cases. Inserting stamps an ordinary event
 * — effects are deep-copied, so later edits never touch the source — and the
 * author still chooses its trigger and checks every value.
 */
export function TemplatePicker({ onInsert }: { onInsert: (preset: EventPreset) => void }) {
  const [filter, setFilter] = useState('');
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Read after mount, never during render (localStorage).
  useEffect(() => setSaved(listSavedEvents()), []);

  const q = filter.trim().toLowerCase();
  const matches = (text: string) => q === '' || text.toLowerCase().includes(q);
  const visibleSaved = saved.filter((e) => matches(`${e.label} ${e.description ?? ''} ${e.category}`));
  const visibleTemplates = EVENT_TEMPLATES.filter((t) =>
    matches(`${t.label} ${t.description} ${t.domain} ${t.category} ${t.source}`),
  );

  const insert = (from: { label: string; description?: string; category: EventCategory; effects: VitalEffect[] }) =>
    onInsert({
      label: from.label,
      description: from.description,
      category: from.category,
      effects: structuredClone(from.effects),
    });

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseLibraryFile(String(reader.result));
      if (!parsed.ok) {
        toast(parsed.errors[0], 'error');
        return;
      }
      const result = importSavedEvents(parsed.file.events);
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      setSaved(listSavedEvents());
      const parts = [`Imported ${result.added} event${result.added === 1 ? '' : 's'}`];
      if (result.skippedDuplicates > 0) {
        parts.push(`${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'} skipped`);
      }
      if (result.droppedOverCap > 0) parts.push(`${result.droppedOverCap} over the cap dropped`);
      toast(parts.join(' — '), result.added > 0 ? 'success' : 'info');
    };
    reader.readAsText(file);
  };

  const row = (
    key: string,
    item: { label: string; description?: string; category: EventCategory; effects: VitalEffect[] },
    meta: string,
    onDelete?: () => void,
  ) => (
    <li key={key} className="flex items-start gap-2 rounded-ctl bg-panel-2 px-3 py-2 ring-1 ring-line">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[item.category]}`}
        title={CATEGORY_LABELS[item.category]}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{item.label}</span>
        <span className="block text-xs text-muted">{describeEvent(item)}</span>
        <span className="block text-[11px] text-faint">{meta}</span>
      </span>
      <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => insert(item)}>
        Use
      </button>
      {onDelete && (
        <button
          type="button"
          className="btn-ghost btn-sm btn-icon shrink-0"
          onClick={onDelete}
          aria-label={`Delete ${item.label} from My events`}
          title="Delete from My events"
        >
          <Icon name="trash" size={14} />
        </button>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <p>
        Templates copy values from the bundled cases (the source is shown on each). Check them
        against your patient and starting vitals, and choose when the event fires.
      </p>
      <input
        className="input"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search templates…"
        aria-label="Search templates"
        data-autofocus
      />
      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        <section className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="label !mb-0">My events</h3>
            {saved.length > 0 && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => downloadJson('capno-events.library.json', serializeLibraryFile(saved))}
              >
                <Icon name="download" size={14} /> Export
              </button>
            )}
            <button type="button" className="btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={14} /> Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {saved.length === 0 ? (
            <p className="text-xs text-faint">
              Nothing saved yet. Open any event and choose “Save to My events”, or import a library file.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleSaved.map((entry) =>
                row(entry.id, entry, `Saved ${new Date(entry.savedAtIso).toLocaleDateString()}`, () => {
                  deleteSavedEvent(entry.id);
                  setSaved(listSavedEvents());
                  toast(`Removed “${entry.label}” from My events`, 'info');
                }),
              )}
            </ul>
          )}
        </section>
        {TEMPLATE_KINDS.map(({ kind, title }) => {
          const items = visibleTemplates.filter((t) => t.kind === kind);
          if (items.length === 0) return null;
          return (
            <section key={kind} className="space-y-1.5">
              <h3 className="label !mb-0">{title}</h3>
              <ul className="space-y-1.5">{items.map((t) => row(t.id, t, `From ${t.source}`))}</ul>
            </section>
          );
        })}
        {visibleTemplates.length === 0 && visibleSaved.length === 0 && (
          <p className="text-sm text-faint">Nothing matches “{filter}”.</p>
        )}
      </div>
    </div>
  );
}
