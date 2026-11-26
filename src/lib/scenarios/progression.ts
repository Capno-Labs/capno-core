import type { ExpectedAction, Scenario, ScenarioEvent, VitalEffect } from '../engine/types';
import {
  AGENT_LABELS,
  CAPNO_SHAPE_LABELS,
  formatStMm,
  NMB_KEYS,
  NMB_META,
  QRS_WIDTH_LABELS,
  QT_INTERVAL_LABELS,
  RHYTHM_LABELS,
  T_WAVE_LABELS,
  VENT_KEYS,
  VENT_META,
} from '../engine/types';
import { VITAL_META } from '../engine/vitals';
import { formatTime } from '../formFields';
import { uniquifyId } from './collections';
import { slugifyScenarioTitle } from './scenarioId';

/**
 * The editor's Progression page as pure operations on a scenario: phases,
 * the events in them and the actions expected in them.
 *
 * Authors never type ids. A new phase, event or action gets one here, and
 * while it is still new its id follows its label; once the case is saved the
 * id is left alone, because sessions and the cloud refer to it. Whenever an
 * id does change, or an item is removed, every reference to it is updated in
 * the same step, so the document never holds a dangling link.
 *
 * Every function returns the changed keys only (a patch for the editor's
 * `update`) and never mutates its input.
 */

type Patch = Partial<Scenario>;

/** An id for `label` that nothing in `taken` uses; `fallback` when the label has no usable characters. */
export function idFromLabel(label: string, taken: Iterable<string>, fallback: string): string {
  return uniquifyId(slugifyScenarioTitle(label) || fallback, new Set(taken));
}

const without = <T>(items: readonly T[], index: number) => items.filter((_, i) => i !== index);
const idsExcept = (items: readonly { id: string }[], index: number) => without(items, index).map((x) => x.id);

// ── Phases ────────────────────────────────────────────────────────────────

export function addPhase(s: Scenario): { patch: Patch; id: string } {
  const id = idFromLabel('', s.phases.map((p) => p.id), 'phase');
  return { patch: { phases: [...s.phases, { id, label: '' }] }, id };
}

function renamePhaseRefs(s: Scenario, from: string, to: string): Patch {
  return {
    events: s.events.map((e) => (e.phaseHint === from ? { ...e, phaseHint: to } : e)),
    expectedActions: s.expectedActions.map((a) => (a.phase === from ? { ...a, phase: to } : a)),
  };
}

/** Relabel a phase. With `followId` (a phase not yet saved) its id follows the label. */
export function setPhaseLabel(s: Scenario, index: number, label: string, followId: boolean): Patch {
  const phase = s.phases[index];
  const id = followId ? idFromLabel(label, idsExcept(s.phases, index), 'phase') : phase.id;
  const phases = s.phases.map((p, i) => (i === index ? { ...p, label, id } : p));
  return id === phase.id ? { phases } : { phases, ...renamePhaseRefs(s, phase.id, id) };
}

/** Remove a phase. What was in it is kept, with no phase. */
export function removePhase(s: Scenario, index: number): Patch {
  const { id } = s.phases[index];
  return {
    phases: without(s.phases, index),
    events: s.events.map((e) => {
      if (e.phaseHint !== id) return e;
      const { phaseHint: _dropped, ...rest } = e;
      return rest;
    }),
    expectedActions: s.expectedActions.map((a) => {
      if (a.phase !== id) return a;
      const { phase: _dropped, ...rest } = a;
      return rest;
    }),
  };
}

// ── Events ────────────────────────────────────────────────────────────────

export function addEvent(
  s: Scenario,
  phaseId: string | undefined,
  preset: Pick<ScenarioEvent, 'category' | 'effects'> & Partial<ScenarioEvent>,
): { patch: Patch; index: number; id: string } {
  const id = idFromLabel(preset.label ?? '', s.events.map((e) => e.id), 'event');
  const event: ScenarioEvent = { label: '', ...preset, id };
  if (phaseId !== undefined) event.phaseHint = phaseId;
  return { patch: { events: [...s.events, event] }, index: s.events.length, id };
}

/** Relabel an event. With `followId` its id follows the label (nothing refers to event ids). */
export function setEventLabel(s: Scenario, index: number, label: string, followId: boolean): Patch {
  const id = followId ? idFromLabel(label, idsExcept(s.events, index), 'event') : s.events[index].id;
  return { events: s.events.map((e, i) => (i === index ? { ...e, label, id } : e)) };
}

/** A copy of an event, placed right after it. */
export function duplicateEvent(s: Scenario, index: number): { patch: Patch; index: number; id: string } {
  const source = s.events[index];
  const label = source.label ? `${source.label} (copy)` : '';
  const id = idFromLabel(label, s.events.map((e) => e.id), 'event');
  const copy: ScenarioEvent = { ...(JSON.parse(JSON.stringify(source)) as ScenarioEvent), id, label };
  const events = [...s.events];
  events.splice(index + 1, 0, copy);
  return { patch: { events }, index: index + 1, id };
}

// ── Expected actions ──────────────────────────────────────────────────────

export function addAction(s: Scenario, phaseId: string | undefined, label: string): { patch: Patch; id: string } {
  const id = idFromLabel(label, s.expectedActions.map((a) => a.id), 'action');
  const action: ExpectedAction = { id, label, critical: false, points: 0 };
  if (phaseId !== undefined) action.phase = phaseId;
  return { patch: { expectedActions: [...s.expectedActions, action] }, id };
}

/** Relabel an action. With `followId` its id follows the label, and so do the links to it. */
export function setActionLabel(s: Scenario, index: number, label: string, followId: boolean): Patch {
  const action = s.expectedActions[index];
  const id = followId ? idFromLabel(label, idsExcept(s.expectedActions, index), 'action') : action.id;
  const expectedActions = s.expectedActions.map((a, i) => (i === index ? { ...a, label, id } : a));
  if (id === action.id) return { expectedActions };
  const swap = (ids: string[]) => ids.map((x) => (x === action.id ? id : x));
  return {
    expectedActions,
    events: s.events.map((e) => (e.actionIds?.includes(action.id) ? { ...e, actionIds: swap(e.actionIds) } : e)),
    rubric: s.rubric.map((c) => (c.actionIds.includes(action.id) ? { ...c, actionIds: swap(c.actionIds) } : c)),
  };
}

/** Remove an action together with every link to it (event links, rubric membership). */
export function removeAction(s: Scenario, index: number): Patch {
  const { id } = s.expectedActions[index];
  return {
    expectedActions: without(s.expectedActions, index),
    events: s.events.map((e) => {
      if (!e.actionIds?.includes(id)) return e;
      const actionIds = e.actionIds.filter((x) => x !== id);
      // An empty link list is written as absent, never [].
      const { actionIds: _dropped, ...rest } = e;
      return actionIds.length > 0 ? { ...e, actionIds } : rest;
    }),
    rubric: s.rubric.map((c) =>
      c.actionIds.includes(id) ? { ...c, actionIds: c.actionIds.filter((x) => x !== id) } : c,
    ),
  };
}

// ── Layout ────────────────────────────────────────────────────────────────

export interface PhaseGroup {
  /** Phase id, or null for what belongs to no phase. */
  phaseId: string | null;
  /** Indices into `scenario.events` / `scenario.expectedActions`, in document order. */
  events: number[];
  actions: number[];
}

/**
 * The page's layout: one group per phase, in phase order, then — only if
 * anything is in it — a last group for events and actions with no phase (or
 * a phase name that no longer exists).
 */
export function groupByPhase(s: Scenario): PhaseGroup[] {
  const known = new Set(s.phases.map((p) => p.id));
  const groups: PhaseGroup[] = s.phases.map((p) => ({
    phaseId: p.id,
    events: s.events.flatMap((e, i) => (e.phaseHint === p.id ? [i] : [])),
    actions: s.expectedActions.flatMap((a, i) => (a.phase === p.id ? [i] : [])),
  }));
  const loose: PhaseGroup = {
    phaseId: null,
    events: s.events.flatMap((e, i) => (e.phaseHint === undefined || !known.has(e.phaseHint) ? [i] : [])),
    actions: s.expectedActions.flatMap((a, i) => (a.phase === undefined || !known.has(a.phase) ? [i] : [])),
  };
  return loose.events.length + loose.actions.length > 0 ? [...groups, loose] : groups;
}

/**
 * Move the item at `index` one place up or down among `group` (the indices
 * shown together on the page, in order) by swapping it with its neighbour
 * there. Items outside the group keep their places.
 */
export function moveWithinGroup<T>(items: readonly T[], group: readonly number[], index: number, by: -1 | 1): T[] {
  const next = [...items];
  const at = group.indexOf(index);
  const other = group[at + by];
  if (at === -1 || other === undefined) return next;
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

// ── Plain-language summaries ──────────────────────────────────────────────

/** "Automatically at 4:00" / "When faculty fires it". */
export function describeTrigger(event: Pick<ScenarioEvent, 'autoAtSec'>): string {
  return event.autoAtSec === undefined ? 'When faculty fires it' : `Automatically at ${formatTime(event.autoAtSec)}`;
}

/**
 * What one effect does, as faculty would say it: "BP 92/52 · HR 104 · EtCO₂
 * 32 · Sinus Tachycardia, over 1:30". Empty string when it changes nothing.
 */
export function describeEffect(effect: VitalEffect): string {
  const v = effect.vitals ?? {};
  const parts: string[] = [];
  if (v.sbp !== undefined && v.dbp !== undefined) parts.push(`BP ${v.sbp}/${v.dbp}`);
  else if (v.sbp !== undefined) parts.push(`Systolic ${v.sbp}`);
  else if (v.dbp !== undefined) parts.push(`Diastolic ${v.dbp}`);
  for (const key of ['hr', 'spo2', 'etco2', 'rr', 'temp', 'depth', 'agentEt', 'agentFi'] as const) {
    if (v[key] !== undefined) parts.push(`${VITAL_META[key].label} ${v[key]}`);
  }
  if (effect.rhythm) parts.push(RHYTHM_LABELS[effect.rhythm]);
  if (effect.pulseless !== undefined) parts.push(effect.pulseless ? 'No pulse' : 'Pulse returns');
  if (effect.capnoShape) parts.push(`CO₂ waveform: ${CAPNO_SHAPE_LABELS[effect.capnoShape]}`);
  if (effect.fico2 !== undefined) parts.push(`Inspired CO₂ ${effect.fico2}`);
  if (effect.ecg?.stMm !== undefined) parts.push(`ST II ${formatStMm(effect.ecg.stMm)} mm`);
  if (effect.ecg?.stV5Mm !== undefined) parts.push(`ST V5 ${formatStMm(effect.ecg.stV5Mm)} mm`);
  if (effect.ecg?.tWave) parts.push(`T wave: ${T_WAVE_LABELS[effect.ecg.tWave]}`);
  if (effect.ecg?.qrs) parts.push(`QRS: ${QRS_WIDTH_LABELS[effect.ecg.qrs]}`);
  if (effect.ecg?.qt) parts.push(`QT: ${QT_INTERVAL_LABELS[effect.ecg.qt]}`);
  for (const key of VENT_KEYS) {
    if (effect.vent?.[key] !== undefined) parts.push(`${VENT_META[key].label} ${effect.vent[key]}`);
  }
  if (effect.agent) parts.push(AGENT_LABELS[effect.agent]);
  for (const key of NMB_KEYS) {
    if (effect.nmb?.[key] !== undefined) parts.push(`${NMB_META[key].label} ${effect.nmb[key]}`);
  }
  if (parts.length === 0) return '';
  const timing: string[] = [];
  if (effect.afterSec) timing.push(`after ${formatTime(effect.afterSec)}`);
  if (effect.overSec) timing.push(`over ${formatTime(effect.overSec)}`);
  return parts.join(' · ') + (timing.length > 0 ? `, ${timing.join(', ')}` : '');
}

/** All of an event's effects on one line; a note when it changes nothing. */
export function describeEvent(event: Pick<ScenarioEvent, 'effects'>): string {
  const lines = event.effects.map(describeEffect).filter((line) => line !== '');
  return lines.length > 0 ? lines.join('  then  ') : 'No change to the monitor (a note in the log)';
}

/** How many optional "more" fields an effect sets — the ones behind the editor's closed group. */
export function countAdvancedEffectFields(effect: VitalEffect): number {
  const v = effect.vitals ?? {};
  return (
    (['temp', 'depth', 'agentEt', 'agentFi'] as const).filter((k) => v[k] !== undefined).length +
    [effect.capnoShape, effect.fico2, effect.pulseless, effect.agent].filter((x) => x !== undefined).length +
    Object.keys(effect.vent ?? {}).length +
    Object.keys(effect.nmb ?? {}).length +
    Object.keys(effect.ecg ?? {}).length
  );
}
