'use client';

import { useState } from 'react';
import { EffectEditor, effectSummary } from '@/components/editor/EventListEditor';
import { CATEGORIES } from '@/components/eventCategories';
import { EVENT_TEMPLATES, TEMPLATE_KINDS } from '@/lib/engine/eventTemplates';
import { eventSchema } from '@/lib/engine/schema';
import type { EventCategory, VitalEffect } from '@/lib/engine/types';
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

export function AddEventForm({ onDone }: { onDone: () => void }) {
  const { addAdhocEvent, pinNextEvent } = useControllerStore();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [effects, setEffects] = useState<VitalEffect[]>([{}]);
  const [templateId, setTemplateId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
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
    <div className="space-y-2 rounded-md bg-slate-900/60 p-2 ring-1 ring-slate-700">
      <div>
        <span className="label">Start from a template (optional)</span>
        <select
          className="input"
          value={templateId}
          onChange={(e) => applyTemplate(e.target.value)}
          aria-label="Event template"
        >
          <option value="">— blank event —</option>
          {TEMPLATE_KINDS.map(({ kind, title }) => (
            <optgroup key={kind} label={title}>
              {EVENT_TEMPLATES.filter((t) => t.kind === kind).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.effects.length > 0 ? ` — ${t.effects.map(effectSummary).join(' | ')}` : ' — log only'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Template values come from the reviewed bundled scenarios — verify them for this patient
          and baseline before firing.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="label">Label</span>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Surgeon reports brisk bleeding"
          />
        </div>
        <div>
          <span className="label">Category</span>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Description (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <span className="label">Effects (empty effect = log-only marker)</span>
        {effects.map((effect, i) => (
          <EffectEditor
            key={i}
            effect={effect}
            onChange={(next) => setEffects(effects.map((ef, j) => (j === i ? next : ef)))}
            onRemove={() => setEffects(effects.filter((_, j) => j !== i))}
          />
        ))}
        <button className="btn-secondary" onClick={() => setEffects([...effects, {}])}>
          + Add effect
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-400">
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
      <p className="text-[10px] text-slate-500">
        Added events are fire-when-ready, live for this session only, and appear in the debrief
        when fired. The scenario itself is not changed.
      </p>
    </div>
  );
}
