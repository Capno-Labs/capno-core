import { z } from 'zod';
import type { SimulationEngine } from '../engine/engine';
import { ALARM_PARAMS } from '../engine/types';

/**
 * What a student display may ask the session to do: operate the monitor's
 * alarms (its alarm setup and its Silence key), and nothing else. A display never changes simulation state
 * itself — it sends one of these, and the authoritative engine (the faculty
 * controller) checks it and applies it, then the next snapshot shows the
 * result on every display.
 *
 * Deliberately narrow and relative: a press of − or + on a limit, an alarms
 * on/off switch, or a press of Silence. No vitals, no events, no session control — and no
 * absolute values, so presses made before the next snapshot arrives are not
 * lost or doubled.
 */
// Every reading with settable alarm limits: the vitals and the machine's.
const alarmVital = z.enum(ALARM_PARAMS);

export const monitorRequestSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('alarmLimitStep'),
      vital: alarmVital,
      side: z.enum(['low', 'high']),
      direction: z.union([z.literal(-1), z.literal(1)]),
    })
    .strict(),
  z.object({ kind: z.literal('alarmOff'), vital: alarmVital, off: z.boolean() }).strict(),
  // The Silence key: acknowledge whatever is alarming now.
  z.object({ kind: z.literal('silence') }).strict(),
]);

export type MonitorRequest = z.infer<typeof monitorRequestSchema>;

/**
 * Apply a display's request to the session's engine. The request arrived
 * over the sync channel, so it is untrusted: anything that is not exactly a
 * known request is dropped, as is everything while faculty have learner
 * alarm setup switched off. Returns whether the engine was touched.
 */
export function applyMonitorRequest(engine: SimulationEngine, raw: unknown): boolean {
  if (!engine.getLearnerAlarmSetup()) return false;
  const parsed = monitorRequestSchema.safeParse(raw);
  if (!parsed.success) return false;
  const request = parsed.data;
  if (request.kind === 'alarmLimitStep') {
    engine.stepAlarmLimit(request.vital, request.side, request.direction, 'display');
  } else if (request.kind === 'alarmOff') {
    engine.setAlarmOff(request.vital, request.off, 'display');
  } else {
    engine.acknowledgeAlarms('display');
  }
  return true;
}

/** How many recent request ids the session remembers. */
const SEEN_IDS = 64;

/**
 * A session can hear the same request twice — once per transport when a
 * display on the same device is also connected through the cloud channel.
 * A press must count once, so each request carries an id and the session
 * drops any id it has already seen. Returns true for a fresh id.
 */
export function createRequestGate(): (id: unknown) => boolean {
  const seen: string[] = [];
  return (id) => {
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) return false;
    if (seen.includes(id)) return false;
    seen.push(id);
    if (seen.length > SEEN_IDS) seen.shift();
    return true;
  };
}

/** A fresh id for a request a display is about to send. */
export function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
