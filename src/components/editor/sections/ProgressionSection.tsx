'use client';

import { useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import type { LintWarning } from '@/lib/engine/lint';
import type { NumericVitals, Scenario, ScenarioEvent } from '@/lib/engine/types';
import { NUMERIC_VITAL_KEYS } from '@/lib/engine/types';
import { moveItem } from '@/lib/formFields';
import { payloadFromEvent, savedEventPayloadSchema } from '@/lib/scenarios/eventLibrary';
import { saveEventToLibrary } from '@/lib/scenarios/eventLibraryStore';
import {
  addAction,
  addEvent,
  addPhase,
  duplicateEvent,
  groupByPhase,
  moveWithinGroup,
  removeAction,
  removePhase,
  setActionLabel,
  setEventLabel,
  setPhaseLabel,
} from '@/lib/scenarios/progression';
import { toast } from '@/lib/store/toastStore';
import { EventCard } from '../EventCard';
import { EventTimeline } from '../EventTimeline';
import { ListEditor } from '../ListEditor';
import { PhaseCard } from '../PhaseCard';
import { TemplatePicker, type EventPreset } from '../TemplatePicker';
import { SectionCard, SectionHead } from './SectionHead';

/**
 * Ids created since the last save, by kind. Only these follow their label as
 * it is typed; a saved id is never changed here (sessions and the cloud
 * refer to it). Owned by ScenarioEditor, which empties the sets on save.
 */
export interface FreshIds {
  phases: Set<string>;
  events: Set<string>;
  actions: Set<string>;
}

export const noFreshIds = (): FreshIds => ({ phases: new Set(), events: new Set(), actions: new Set() });

/**
 * What happens during the case, on one page: each phase with the changes in
 * it beside the actions learners are expected to take, then the faculty's
 * notes. The operations themselves are pure (lib/scenarios/progression.ts);
 * this component holds only what is on screen — which event is open.
 */
export function ProgressionSection({
  scenario,
  update,
  warnings,
  fresh,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
  warnings: LintWarning[];
  fresh: FreshIds;
}) {
  const { phases, events, expectedActions: actions } = scenario;
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  /** Phase a template is being picked for (null = "no phase"); undefined = picker closed. */
  const [pickFor, setPickFor] = useState<string | null | undefined>(undefined);

  // Remembers each event's last automatic time across trigger toggles, so
  // switching to faculty-fired and back does not lose it. Never serialized.
  const autoStash = useRef<Map<string, number>>(new Map());

  /** Move an id's "fresh" mark along when the id follows its label. */
  const carry = (set: Set<string>, from: string, to: string) => {
    if (from !== to && set.delete(from)) set.add(to);
  };

  const revealEvent = (id: string) => {
    setOpenEvent(id);
    // After the card has rendered open.
    window.setTimeout(() => {
      document.getElementById(`event-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  };

  const patchEvent = (index: number, patch: Partial<ScenarioEvent>) =>
    update({ events: events.map((e, i) => (i === index ? { ...e, ...patch } : e)) });

  const setTrigger = (index: number, auto: boolean) => {
    const event = events[index];
    if (auto === (event.autoAtSec !== undefined)) return;
    const next = { ...event };
    if (auto) next.autoAtSec = autoStash.current.get(event.id) ?? 0;
    else {
      if (event.autoAtSec !== undefined) autoStash.current.set(event.id, event.autoAtSec);
      delete next.autoAtSec;
    }
    update({ events: events.map((e, i) => (i === index ? next : e)) });
  };

  const insertEvent = (phaseId: string | null, preset: EventPreset) => {
    const added = addEvent(scenario, phaseId ?? undefined, preset);
    fresh.events.add(added.id);
    update(added.patch);
    revealEvent(added.id);
  };

  const addEventOfKind = (phaseId: string | null, kind: 'timed' | 'faculty' | 'note' | 'recovery' | 'template') => {
    if (kind === 'template') setPickFor(phaseId);
    else if (kind === 'timed') insertEvent(phaseId, { category: 'physiology', autoAtSec: 0, effects: [{}] });
    else if (kind === 'faculty') insertEvent(phaseId, { category: 'drug', effects: [{}] });
    else if (kind === 'note') insertEvent(phaseId, { category: 'other', effects: [] });
    else {
      // The author's own starting numbers, copied — nothing invented.
      const vitals: Partial<NumericVitals> = {};
      for (const key of NUMERIC_VITAL_KEYS) vitals[key] = scenario.baselineVitals[key];
      insertEvent(phaseId, {
        label: 'Return to starting vitals',
        category: 'resolution',
        effects: [{ vitals, rhythm: scenario.baselineVitals.rhythm }],
      });
    }
  };

  const saveToLibrary = (event: ScenarioEvent) => {
    const payload = payloadFromEvent(event);
    if (!savedEventPayloadSchema.safeParse(payload).success) {
      toast('Give the event a name and valid changes before saving it.', 'error');
      return;
    }
    const result = saveEventToLibrary(payload);
    if (result.ok) toast(`Saved “${payload.label}” to My events`, 'success');
    else toast(result.error, result.duplicate ? 'info' : 'error');
  };

  const groups = groupByPhase(scenario);
  const eventLabel = (e: ScenarioEvent) => e.label || 'Untitled';

  return (
    <div className="space-y-4">
      <SectionHead title="Progression">
        What happens, phase by phase: the changes on the left, and what learners should do about
        them on the right.
      </SectionHead>

      {events.length > 0 && (
        <SectionCard
          title="Run order"
          hint="Timed events in the order they fire, then the ones faculty fire. Select one to open it."
        >
          <EventTimeline
            events={events}
            estimatedMinutes={scenario.estimatedMinutes}
            onSelect={(i) => revealEvent(events[i].id)}
          />
        </SectionCard>
      )}

      {groups.map((group, g) => {
        const phaseIndex = phases.findIndex((p) => p.id === group.phaseId);
        const phase = phaseIndex === -1 ? null : phases[phaseIndex];
        return (
          <PhaseCard
            key={group.phaseId ?? '·none'}
            phase={phase}
            number={g + 1}
            position={phaseIndex}
            count={phases.length}
            phases={phases}
            eventCards={group.events.map((index, at) => {
              const event = events[index];
              return (
                <EventCard
                  key={event.id || index}
                  event={event}
                  open={openEvent === event.id}
                  position={at}
                  count={group.events.length}
                  phases={phases}
                  actions={actions}
                  warnings={warnings.filter((w) => w.path.startsWith(`events.${index}.`))}
                  onToggle={() => setOpenEvent(openEvent === event.id ? null : event.id)}
                  onChange={(patch) => patchEvent(index, patch)}
                  onLabel={(label) => {
                    const patch = setEventLabel(scenario, index, label, fresh.events.has(event.id));
                    const id = patch.events![index].id;
                    carry(fresh.events, event.id, id);
                    if (openEvent === event.id) setOpenEvent(id);
                    update(patch);
                  }}
                  onSetAuto={(auto) => setTrigger(index, auto)}
                  onMove={(by) => update({ events: moveWithinGroup(events, group.events, index, by) })}
                  onRemove={() => update({ events: events.filter((_, i) => i !== index) })}
                  onDuplicate={() => {
                    const dup = duplicateEvent(scenario, index);
                    fresh.events.add(dup.id);
                    update(dup.patch);
                    revealEvent(dup.id);
                  }}
                  onSaveToLibrary={() => saveToLibrary(event)}
                />
              );
            })}
            actions={group.actions.map((index) => ({
              index,
              action: actions[index],
              linkedFrom: events.filter((e) => e.actionIds?.includes(actions[index].id)).map(eventLabel),
            }))}
            onLabel={(label) => {
              if (!phase) return;
              const patch = setPhaseLabel(scenario, phaseIndex, label, fresh.phases.has(phase.id));
              carry(fresh.phases, phase.id, patch.phases![phaseIndex].id);
              update(patch);
            }}
            onChange={(patch) => {
              const next = { ...phases[phaseIndex], ...patch };
              for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
                if (patch[key] === undefined) delete next[key];
              }
              update({ phases: phases.map((p, i) => (i === phaseIndex ? next : p)) });
            }}
            onMove={(to) => update({ phases: moveItem(phases, phaseIndex, to) })}
            onRemove={() => update(removePhase(scenario, phaseIndex))}
            onAddEvent={(kind) => addEventOfKind(group.phaseId, kind)}
            onAddAction={(label) => {
              const added = addAction(scenario, group.phaseId ?? undefined, label);
              fresh.actions.add(added.id);
              update(added.patch);
            }}
            onActionLabel={(index, label) => {
              const before = actions[index].id;
              const patch = setActionLabel(scenario, index, label, fresh.actions.has(before));
              carry(fresh.actions, before, patch.expectedActions![index].id);
              update(patch);
            }}
            onActionChange={(index, patch) => {
              const next = { ...actions[index], ...patch };
              for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
                if (patch[key] === undefined) delete next[key];
              }
              update({ expectedActions: actions.map((a, i) => (i === index ? next : a)) });
            }}
            onActionMove={(index, by) =>
              update({ expectedActions: moveWithinGroup(actions, group.actions, index, by) })
            }
            onActionRemove={(index) => update(removeAction(scenario, index))}
          />
        );
      })}

      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          const added = addPhase(scenario);
          fresh.phases.add(added.id);
          update(added.patch);
        }}
      >
        <Icon name="plus" size={16} /> Add a phase
      </button>

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

      <Dialog
        open={pickFor !== undefined}
        onClose={() => setPickFor(undefined)}
        title="Start from a template"
        size="lg"
      >
        {pickFor !== undefined && (
          <TemplatePicker
            onInsert={(preset) => {
              insertEvent(pickFor, preset);
              setPickFor(undefined);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
