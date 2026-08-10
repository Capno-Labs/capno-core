/**
 * Section metadata for the case editor's navigation rail.
 *
 * The editor organizes the scenario document into instructor-facing sections
 * rather than JSON key order. `sectionOfPath` maps a validation/lint dot-path
 * (e.g. "events.3.effects.0.vitals.hr") to its owning section so the rail can
 * badge issue counts and the active surface can show only its own issues.
 */

export type SectionId =
  | 'overview'
  | 'patient'
  | 'vitals'
  | 'timeline'
  | 'assessment'
  | 'teaching'
  | 'history';

export interface SectionMeta {
  id: SectionId;
  label: string;
}

/** Rail order. `history` is appended by the shell (it has no schema keys). */
export const SECTIONS: SectionMeta[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'patient', label: 'Patient' },
  { id: 'vitals', label: 'Vitals & monitoring' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'teaching', label: 'Teaching & debrief' },
];

/** Top-level scenario key → owning section. Every schema key maps somewhere;
 *  unknown prefixes (pathless save errors, "Invalid JSON: …") stay global. */
const KEY_TO_SECTION: Record<string, SectionId> = {
  id: 'overview',
  version: 'overview',
  title: 'overview',
  summary: 'overview',
  tags: 'overview',
  estimatedMinutes: 'overview',
  targetDurationSec: 'overview',
  patient: 'patient',
  baselineVitals: 'vitals',
  monitoring: 'vitals',
  phases: 'timeline',
  events: 'timeline',
  expectedActions: 'assessment',
  rubric: 'assessment',
  learningObjectives: 'teaching',
  setup: 'teaching',
  expectedProgression: 'teaching',
  correctManagement: 'teaching',
  commonErrors: 'teaching',
  debrief: 'teaching',
};

export function sectionOfPath(path: string): SectionId | null {
  const head = path.split('.')[0]?.trim();
  return head ? (KEY_TO_SECTION[head] ?? null) : null;
}

/** Split a `"dot.path: message"` issue string (the `validateScenario` output
 *  format) into its owning section, or null for pathless/global issues. */
export function sectionOfIssue(issue: string): SectionId | null {
  const colon = issue.indexOf(':');
  if (colon <= 0) return null;
  return sectionOfPath(issue.slice(0, colon));
}
