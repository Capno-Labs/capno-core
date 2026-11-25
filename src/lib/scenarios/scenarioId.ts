import type { Scenario } from '../engine/types';
import { uniquifyId } from './collections';

/**
 * Case identity helpers for the editor and library. A case's id is its
 * storage key (version history, cloud sync, run links), so it is generated
 * once — from the title, on first save — and never shared between cases.
 */

/** Placeholder id a never-saved case carries until its first save. */
export const NEW_SCENARIO_ID = 'my-new-scenario';

const MAX_ID_LENGTH = 60;

/** Kebab-case slug that satisfies the schema's id rule; '' if nothing usable. */
export function slugifyScenarioTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_ID_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/** A fresh id for `title` that no existing case uses. */
export function scenarioIdFromTitle(title: string, taken: ReadonlySet<string>): string {
  // The placeholder is never handed out, whatever the title is.
  return uniquifyId(slugifyScenarioTitle(title) || 'case', new Set([...taken, NEW_SCENARIO_ID]));
}

/** “Title (copy)”, then “Title (copy 2)”, … — unique among `takenTitles`. */
export function copyTitle(title: string, takenTitles: ReadonlySet<string>): string {
  const base = title.replace(/ \(copy(?: \d+)?\)$/, '');
  const first = `${base} (copy)`;
  if (!takenTitles.has(first)) return first;
  for (let n = 2; ; n++) {
    const candidate = `${base} (copy ${n})`;
    if (!takenTitles.has(candidate)) return candidate;
  }
}

/**
 * A new, unsaved case that starts from `source`: same content (tags
 * included — an `ai-generated` tag stays until a reviewer removes it), a
 * "(copy)" title, and the placeholder id so its first save generates its own.
 */
export function templateFrom(source: Scenario, takenTitles: ReadonlySet<string>): Scenario {
  return {
    ...(JSON.parse(JSON.stringify(source)) as Scenario),
    id: NEW_SCENARIO_ID,
    title: copyTitle(source.title, takenTitles),
  };
}

/** A copy of `source` ready to save under its own id and history. */
export function duplicateScenario(
  source: Scenario,
  takenIds: ReadonlySet<string>,
  takenTitles: ReadonlySet<string>,
): Scenario {
  const copy = templateFrom(source, takenTitles);
  return { ...copy, id: scenarioIdFromTitle(copy.title, takenIds) };
}
