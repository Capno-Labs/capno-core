'use client';

import { useState } from 'react';
import { EffectFields } from '@/components/editor/EffectFields';
import { CATEGORIES, CATEGORY_LABELS } from '@/components/eventCategories';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/SelectField';
import { EVENT_TEMPLATES, TEMPLATE_KINDS } from '@/lib/engine/eventTemplates';
import { eventSchema } from '@/lib/engine/schema';
import type { EventCategory, VitalEffect } from '@/lib/engine/types';
import type { SavedEvent } from '@/lib/scenarios/eventLibrary';
import { listSavedEvents } from '@/lib/scenarios/eventLibraryStore';
import { describeEvent } from '@/lib/scenarios/progression';
import { useControllerStore } from '@/lib/store/controllerStore';
import { formatZodIssues } from '@/lib/zodIssues';

/**
 * Live add-event form: lets the instructor improvise an event mid-session.
 * Ad-hoc events are fire-when-ready only (no autoAtSec, no rubric links —
 * the store action's type enforces both) and exist for this session only:
 * the source scenario is never touched; the archive keeps them via the
 * effective scenario.
 *
 * Same clinical-content stance as the editor: the form pre-fills no vital
 * values. Templates copy reviewed values from the bundled scenarios and say
 * so; anything else the instructor types is their call, live in the room.
 */

// What the form actually authors: no id (the store generates it), no
// autoAtSec / actionIds (ad-hoc events are fire-when-ready only).
const adhocEventSchema = eventSchema.omit({ id: true, autoAtSec: true, actionIds: true });

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

export function AddEventForm({ onDone }: { onDone: () => void }) {
  const { addAdhocEvent, pinNextEvent } = useControllerStore();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [effects, setEffects] = useState<VitalEffect[]>([{}]);
  const [templateId, setTemplateId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  // Personal event library, offered alongside the curated templates. Lazy
  // initializer is safe here: this form mounts only on a user click, well
  // after hydration, so localStorage is readable.
  const [savedEvents] = useState<SavedEvent[]>(() => listSavedEvents());

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    // Library options are namespaced 'lib:<id>' so they can never collide
    // with curated template ids.
    if (id.startsWith('lib:')) {
      const entry = savedEvents.find((e) => `lib:${e.id}` === id);
      if (!entry) return;
      setLabel(entry.label);
      setDescription(entry.description ?? '');
      setCategory(entry.category);
      setEffects(structuredClone(entry.effects));
      setErrors([]);
      return;
    }
    const t = EVENT_TEMPLATES.find((tpl) => tpl.id === id);
    if (!t) {
      // "— blank event —" re-selected: clear everything, or the previous
      // template's clinical effects would stay staged under a blank picker.
      setLabel('');
      setDescription('');
      setCategory('other');
      setEffects([{}]);
      setErrors([]);
      return;
    }
    setLabel(t.label);
    setDescription(t.description);
    setCategory(t.category);
    // Deep-copy so edits never touch the template registry.
    setEffects(structuredClone(t.effects));
    setErrors([]);
  };

  const submit = (makeNext: boolean) => {
    const candidate = {
      label: label.trim(),
      description: description.trim() === '' ? undefined : description.trim(),
      category,
      effects,
    };
    const parsed = adhocEventSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(formatZodIssues(parsed.error));
      return;
    }
    const newId = addAdhocEvent(candidate);
    if (newId === null) {
      setErrors(['Could not add the event — check the values and that a session is loaded.']);
      return;
    }
    if (makeNext) pinNextEvent(newId);
    onDone(); // unmounts the form; it remounts fresh on the next toggle
  };

  return (
    <div className="space-y-3 rounded-ctl bg-panel/60 p-3 ring-1 ring-line">
      <Field
        label="Start from a template"
        hint="Optional. Template values come from the reviewed bundled scenarios; “My events” are your own saved values. Check either against this patient before firing."
      >
        <select className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">Blank event</option>
          {savedEvents.length > 0 && (
            <optgroup label="My events">
              {savedEvents.map((e) => (
                <option key={e.id} value={`lib:${e.id}`}>
                  {e.label} — {describeEvent(e)}
                </option>
              ))}
            </optgroup>
          )}
          {TEMPLATE_KINDS.map(({ kind, title }) => (
            <optgroup key={kind} label={title}>
              {EVENT_TEMPLATES.filter((t) => t.kind === kind).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} — {describeEvent(t)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What happens">
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="For example: Surgeon reports brisk bleeding"
          />
        </Field>
        <SelectField
          label="Category"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(c) => c && setCategory(c)}
        />
      </div>
      <Field label="Notes for faculty" hint="Optional.">
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="space-y-2">
        <span className="label">What it changes</span>
        {effects.length === 0 && (
          <p className="text-sm text-muted">
            Nothing on the monitor. Firing it only writes a note in the session log.
          </p>
        )}
        {effects.map((effect, i) => (
          <EffectFields
            key={i}
            effect={effect}
            title={effects.length > 1 ? `Change ${i + 1}` : undefined}
            onChange={(next) => setEffects(effects.map((ef, j) => (j === i ? next : ef)))}
            onRemove={() => setEffects(effects.filter((_, j) => j !== i))}
          />
        ))}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setEffects([...effects, {}])}>
          <Icon name="plus" size={14} />
          {effects.length === 0 ? 'Add a change' : 'Add another change'}
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => submit(false)}>
          Add event
        </button>
        <button className="btn-secondary" onClick={() => submit(true)}>
          Add &amp; make next
        </button>
        <button className="btn-ghost ml-auto" onClick={onDone}>
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-faint">
        Added events are fire-when-ready, live for this session only, and appear in the debrief
        when fired. The scenario itself is not changed.
      </p>
    </div>
  );
}
