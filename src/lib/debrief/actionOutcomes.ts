import type { ActionStatus, ExpectedAction, Scenario, SimSnapshot } from '../engine/types';

/**
 * What became of each expected action, read straight from the archive: the
 * mark faculty gave it, when, and when the event that called for it fired.
 * Pure presentation data for the debrief — nothing here is a judgement the
 * app made, and nothing reads the stored score.
 */

/** A finished session has no pending actions: unmarked reads as missed. */
export type OutcomeStatus = Exclude<ActionStatus, 'pending'>;

export interface ActionOutcome {
  action: ExpectedAction;
  status: OutcomeStatus;
  /** Scenario seconds when faculty marked it, if they did. */
  markedAtSec?: number;
  /** Scenario seconds when the first event linked to this action fired. */
  triggeredAtSec?: number;
  /** That event's label — what the learner was facing at the time. */
  triggerLabel?: string;
  phaseLabel?: string;
}

/** Structural subset of ArchivedSession so tests stay light. */
export interface ActionOutcomeInput {
  scenario: Pick<Scenario, 'expectedActions' | 'events' | 'phases'>;
  snapshot: Pick<SimSnapshot, 'actions' | 'log'>;
}

export function deriveActionOutcomes(session: ActionOutcomeInput): ActionOutcome[] {
  const { scenario, snapshot } = session;
  const recordById = new Map(snapshot.actions.map((r) => [r.actionId, r]));
  const phaseLabelById = new Map(scenario.phases.map((p) => [p.id, p.label]));

  // First time each event label reached the log (events are logged by label).
  const firedAtByLabel = new Map<string, number>();
  for (const entry of snapshot.log) {
    if (entry.kind === 'event' && !firedAtByLabel.has(entry.label)) {
      firedAtByLabel.set(entry.label, entry.t);
    }
  }
  const triggerByActionId = new Map<string, { t: number; label: string }>();
  for (const event of scenario.events) {
    const firedAt = firedAtByLabel.get(event.label);
    if (firedAt === undefined) continue;
    for (const actionId of event.actionIds ?? []) {
      const prior = triggerByActionId.get(actionId);
      if (prior === undefined || firedAt < prior.t) {
        triggerByActionId.set(actionId, { t: firedAt, label: event.label });
      }
    }
  }

  return scenario.expectedActions.map((action) => {
    const record = recordById.get(action.id);
    const status: OutcomeStatus = !record || record.status === 'pending' ? 'missed' : record.status;
    const phaseLabel = action.phase ? phaseLabelById.get(action.phase) : undefined;
    const trigger = triggerByActionId.get(action.id);
    return {
      action,
      status,
      ...(record?.markedAtSec !== undefined ? { markedAtSec: record.markedAtSec } : {}),
      ...(trigger ? { triggeredAtSec: trigger.t, triggerLabel: trigger.label } : {}),
      ...(phaseLabel ? { phaseLabel } : {}),
    };
  });
}

/** An action the debrief should come back to: anything not cleanly done. */
export function isGap(outcome: ActionOutcome): boolean {
  return outcome.status !== 'done';
}
