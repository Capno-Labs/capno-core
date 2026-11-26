import type { Scenario } from './types';

/**
 * Soft authoring checks for the scenario editor.
 *
 * These are advisory only — they never block saving or running a scenario,
 * and they are deliberately NOT part of `schema.ts` validation: every
 * bundled scenario and every scenario already sitting in a user's
 * localStorage must keep validating unchanged. Anything that would reject a
 * currently-valid document belongs in the schema (with a migration story),
 * not here.
 */

export interface LintWarning {
  /** 'warning' = probably a mistake; 'info' = worth a look, often intentional. */
  severity: 'warning' | 'info';
  /** Dot path in `validateScenario` error style, e.g. "events.2.phaseHint". */
  path: string;
  message: string;
}

/**
 * The closed curriculum domain vocabulary (see docs/curriculum.md). By
 * convention one of these appears in `tags.topics` — the case library
 * groups scenarios by it. Deliberately a convention, not schema: scenarios
 * with free-form topics stay valid and land in the library's
 * "Custom & drafts" section.
 */
export const DOMAINS = [
  'airway',
  'respiratory',
  'cardiac',
  'hemodynamics',
  'hemorrhage',
  'embolic',
  'hypersensitivity',
  'toxicity',
  'temperature/metabolic',
  'neuro',
  'equipment',
] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * The scenario's curriculum domain: the first topic tag that is in the
 * closed vocabulary. Position-independent so tags added around the domain
 * (e.g. the `ai-generated` draft tag) don't hide it.
 */
export function domainOf(scenario: Scenario): Domain | undefined {
  return scenario.tags.topics.find((t): t is Domain => (DOMAINS as readonly string[]).includes(t));
}

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

export function lintScenario(scenario: Scenario): LintWarning[] {
  const warnings: LintWarning[] = [];
  const phaseIds = new Set(scenario.phases.map((p) => p.id));
  const runEndSec = scenario.estimatedMinutes * 60;

  // Info, not warning: older custom scenarios legitimately predate the
  // domain vocabulary and must keep linting clean enough to work with.
  if (domainOf(scenario) === undefined) {
    warnings.push({
      severity: 'info',
      path: 'tags.topics',
      message: 'No curriculum area is chosen, so the library lists this case under "Custom & drafts".',
    });
  }

  // A child on adult limits alarms on normal vitals. Info only: the author
  // may want exactly that, and limits set by hand count as a decision.
  if (
    scenario.patient.age < 18 &&
    scenario.monitoring?.alarmProfile === undefined &&
    scenario.monitoring?.alarmLimits === undefined
  ) {
    warnings.push({
      severity: 'info',
      path: 'monitoring.alarmProfile',
      message:
        'The patient is under 18 but the monitor uses the adult alarm limits. If normal vitals for this patient would alarm, choose the pediatric or neonatal limits (Starting state, Alarm limits).',
    });
  }

  let prevAutoAt: number | undefined;
  let flaggedOutOfOrder = false;

  scenario.events.forEach((event, i) => {
    if (event.phaseHint !== undefined && !phaseIds.has(event.phaseHint)) {
      warnings.push({
        severity: 'warning',
        path: `events.${i}.phaseHint`,
        message: `Its phase, "${event.phaseHint}", is not one of this case's phases. Faculty see that text as written.`,
      });
    }

    if (event.autoAtSec !== undefined && event.autoAtSec > runEndSec) {
      warnings.push({
        severity: 'warning',
        path: `events.${i}.autoAtSec`,
        message: `Fires at ${fmtTime(event.autoAtSec)}, after the expected length of ${fmtTime(runEndSec)}.`,
      });
    }

    if (event.effects.length === 0) {
      warnings.push({
        severity: 'info',
        path: `events.${i}.effects`,
        message: 'Changes nothing on the monitor; it only adds a line to the log. Fine for a marker such as "drug given".',
      });
    }

    if (event.autoAtSec === 0) {
      warnings.push({
        severity: 'info',
        path: `events.${i}.autoAtSec`,
        message: 'Fires the moment the case starts. Set a time if that is not intended.',
      });
    }

    if (event.autoAtSec !== undefined) {
      // Flag once per scenario: the run screen sorts timed events anyway, but
      // narrative order in the file helps faculty read the scenario.
      if (!flaggedOutOfOrder && prevAutoAt !== undefined && event.autoAtSec < prevAutoAt) {
        warnings.push({
          severity: 'info',
          path: `events.${i}.autoAtSec`,
          message: 'Timed events are listed out of time order. The run screen sorts them by time, but in order they are easier to review.',
        });
        flaggedOutOfOrder = true;
      }
      prevAutoAt = event.autoAtSec;
    }
  });

  return warnings;
}
