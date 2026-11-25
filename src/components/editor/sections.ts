/**
 * Section metadata for the case editor's navigation rail.
 *
 * The rail follows the order faculty write a case in — the order of every
 * paper scenario template: what the case is for, who the patient is, how they
 * start, what happens, how it is debriefed, then a final check. It is not the
 * JSON key order. `sectionOfPath` maps a validation/lint dot-path (e.g.
 * "events.3.effects.0.vitals.hr") to its owning section so the rail can badge
 * issue counts and the active surface can show only its own issues.
 */

export type SectionId = 'basics' | 'patient' | 'start' | 'progression' | 'debrief' | 'review';

export interface SectionMeta {
  id: SectionId;
  label: string;
}

/** Rail order. */
export const SECTIONS: SectionMeta[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'patient', label: 'Patient' },
  { id: 'start', label: 'Starting state' },
  { id: 'progression', label: 'Progression' },
  { id: 'debrief', label: 'Debrief' },
  { id: 'review', label: 'Review & publish' },
];

/** Top-level scenario key → owning section. Every schema key maps somewhere;
 *  unknown prefixes (pathless save errors, "Invalid JSON: …") stay global. */
const KEY_TO_SECTION: Record<string, SectionId> = {
  title: 'basics',
  summary: 'basics',
  tags: 'basics',
  estimatedMinutes: 'basics',
  targetDurationSec: 'basics',
  learningObjectives: 'basics',
  setup: 'basics',
  patient: 'patient',
  baselineVitals: 'start',
  monitoring: 'start',
  phases: 'progression',
  events: 'progression',
  expectedActions: 'progression',
  expectedProgression: 'progression',
  correctManagement: 'progression',
  commonErrors: 'progression',
  debrief: 'debrief',
  // Scoring and the case's identity sit behind "Review & publish".
  rubric: 'review',
  id: 'review',
  version: 'review',
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

/** Section ids of the rail before the 2026-11 redesign → where that content
 *  lives now, so old `#timeline` links and bookmarks still land somewhere. */
const LEGACY_SECTIONS: Record<string, SectionId> = {
  overview: 'basics',
  vitals: 'start',
  timeline: 'progression',
  assessment: 'progression',
  teaching: 'debrief',
  history: 'review',
};

/** The section a URL hash names (current or legacy id), or null. */
export function sectionOfHash(hash: string): SectionId | null {
  const h = hash.replace(/^#/, '');
  if (SECTIONS.some((s) => s.id === h)) return h as SectionId;
  return LEGACY_SECTIONS[h] ?? null;
}
