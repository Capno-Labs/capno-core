import type { SimSnapshot } from '../engine/types';

/**
 * What a student display is sent: the monitor, and nothing else.
 *
 * The session's snapshot is the faculty device's whole working state — the
 * notes faculty type about learners, the log, the rubric marks, which events
 * have fired, which case this is. A display draws none of that, and the sync
 * channel is joined with a short code that is a classroom convenience, not a
 * lock. So the controller sends only the fields below, and a display keeps
 * only these from whatever it hears.
 *
 * It is a list of what goes out, not of what stays behind: a field added to
 * `SimSnapshot` reaches learners only if someone adds it here on purpose.
 * Every field must be sorted into one of the two lists — the check at the
 * bottom of this file fails the typecheck otherwise.
 */
export const DISPLAY_FIELDS = [
  'status',
  'elapsedSec',
  'vitals',
  'nibp',
  'gas',
  'tof',
  'v5Lead',
  'alarms',
  'alarmsSilenced',
  'alarmLimits',
  'alarmsOff',
  'learnerAlarmSetup',
  'preBrief',
] as const satisfies readonly (keyof SimSnapshot)[];

/** Stays on the faculty device. Never sent to a display. */
export const FACULTY_ONLY_FIELDS = [
  'scenarioId', // names the case
  'sessionId', // the archive key; a display knows the code it joined with
  'phaseId', // the case's script position
  'phaseChangedAtSec',
  'actions', // the rubric and how the learner is doing against it
  'log',
  'notes', // free text about learners
  'firedEventIds',
  'autoEventsEnabled',
  'alarmProfile', // a display prints the limits themselves, not the profile's name
] as const satisfies readonly (keyof SimSnapshot)[];

export type DisplayField = (typeof DISPLAY_FIELDS)[number];
export type DisplaySnapshot = Pick<SimSnapshot, DisplayField>;

/**
 * The display's view of a snapshot. Copies the listed fields that are
 * present and nothing else, so it also serves on the receiving side: a
 * display runs whatever arrives through it and never holds more than the
 * monitor needs, even when an older controller sends the full snapshot.
 */
export function toDisplaySnapshot(snapshot: SimSnapshot | DisplaySnapshot): DisplaySnapshot {
  const source = snapshot as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of DISPLAY_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out as DisplaySnapshot;
}

// Every SimSnapshot field is in exactly one list. Adding a field without
// deciding whether learners may see it makes one of these lines a type error.
type Unsorted = Exclude<keyof SimSnapshot, DisplayField | (typeof FACULTY_ONLY_FIELDS)[number]>;
type InBoth = Extract<DisplayField, (typeof FACULTY_ONLY_FIELDS)[number]>;
export const EVERY_FIELD_IS_SORTED: [Unsorted] extends [never] ? true : never = true;
export const NO_FIELD_IS_IN_BOTH: [InBoth] extends [never] ? true : never = true;
