import type { LintWarning } from '@/lib/engine/lint';
import type { NumericVitals, Scenario } from '@/lib/engine/types';
import { FIELD_LABELS, GROUP_LABELS, VITAL_NAMES } from './fieldLabels';
import { sectionOfPath, type SectionId } from './sections';

/**
 * The readiness checklist: every schema error and authoring note about a
 * case, said in the editor's own words.
 *
 * `validateScenario` and `lintScenario` report a dot path into the JSON
 * ("events.3.effects.0.vitals.hr"). Faculty never see the JSON, so each path
 * is turned into where the field is on screen ("Event “Hypotension”, Heart
 * rate") and each schema message into a plain sentence. `anchorId` and
 * `field` say where "Show me" should land: the card's DOM id, and the label
 * of the field inside it (or inside the section).
 */

export interface ReadinessItem {
  /** 'fix' blocks saving; 'look' is advice and never blocks anything. */
  level: 'fix' | 'look';
  /** The rail section the field is on; null when the path names none. */
  section: SectionId | null;
  /** Where it is, as the editor names it. */
  where: string;
  /** What is wrong, as a sentence. */
  message: string;
  /** The original dot path, kept for filtering and tests. */
  path: string;
  /** DOM id of the card that holds the field (an event, phase or action). */
  anchorId?: string;
  /** Visible label of the field to focus. */
  field?: string;
}

interface Place {
  where: string;
  anchorId?: string;
  field?: string;
}

const isIndex = (seg: string | undefined): seg is string => seg !== undefined && /^\d+$/.test(seg);
const quoted = (label: string | undefined, fallback: string) => (label?.trim() ? `“${label.trim()}”` : fallback);

function placeInEvent(rest: string[], s: Scenario, index: number): Place {
  const event = s.events[index];
  const name = event?.label.trim() ? `Event ${quoted(event.label, '')}` : 'An unnamed event';
  const anchorId = event ? `event-${event.id}` : undefined;
  const at = (field?: string): Place => ({ where: field ? `${name}, ${field}` : name, anchorId, field });
  const [key, i, sub, subKey] = rest;
  switch (key) {
    case 'label':
      return at('What happens');
    case 'description':
      return at('Notes for faculty');
    case 'autoAtSec':
      return at('At');
    case 'phaseHint':
      return at('Phase');
    case 'category':
      return at('Category');
    case 'actionIds':
      return at('Learner actions this goes with');
    case 'id':
      return { where: `${name}, ID`, anchorId };
    case 'effects': {
      if (!isIndex(i)) return at();
      const many = (event?.effects.length ?? 0) > 1 ? ` (change ${Number(i) + 1})` : '';
      const field =
        sub === 'vitals' && subKey && subKey in VITAL_NAMES
          ? VITAL_NAMES[subKey as keyof NumericVitals]
          : sub === 'overSec'
            ? 'Takes'
            : sub === 'afterSec'
              ? 'Starts after'
              : sub === 'rhythm'
                ? 'Rhythm'
                : undefined;
      return { where: `${name}, ${field ?? 'what it changes'}${many}`, anchorId, field };
    }
    default:
      return at();
  }
}

function place(path: string, s: Scenario): Place {
  const segs = path.split('.');
  const [head, i, ...rest] = segs;

  if (head === 'events' && isIndex(i)) return placeInEvent(rest, s, Number(i));

  if (head === 'phases') {
    if (!isIndex(i)) return { where: 'Phases' };
    const phase = s.phases[Number(i)];
    const name = `Phase ${Number(i) + 1}${phase?.label.trim() ? ` ${quoted(phase.label, '')}` : ''}`;
    const anchorId = phase ? `phase-${phase.id}` : undefined;
    const field = { description: 'What is going on', targetDurationSec: 'Should take' }[rest[0] ?? ''];
    const what = field ?? (rest[0] === 'label' ? 'name' : rest[0] === 'id' ? 'ID' : undefined);
    return { where: what ? `${name}, ${what}` : name, anchorId, field };
  }

  if (head === 'expectedActions') {
    if (!isIndex(i)) return { where: 'Learner actions' };
    const action = s.expectedActions[Number(i)];
    const name = action?.label.trim() ? `Action ${quoted(action.label, '')}` : 'An unnamed action';
    const anchorId = action ? `action-${action.id}` : undefined;
    const field = { points: 'Points', phase: 'Phase', description: 'Note' }[rest[0] ?? ''];
    const what = field ?? (rest[0] === 'id' ? 'ID' : undefined);
    return { where: what ? `${name}, ${what}` : name, anchorId, field };
  }

  if (head === 'rubric') {
    if (!isIndex(i)) return { where: 'Scoring' };
    const category = s.rubric[Number(i)];
    const name = `Scoring category ${quoted(category?.label, String(Number(i) + 1))}`;
    const field = rest[0] === 'label' ? 'Category name' : undefined;
    return { where: field ? `${name}, name` : name, anchorId: `rubric-${i}`, field };
  }

  if (head === 'baselineVitals' && i !== undefined && i in VITAL_NAMES) {
    const field = VITAL_NAMES[i as keyof NumericVitals];
    return { where: field, field };
  }

  // A plain field, with any list position dropped ("setup.2" is "Setup steps").
  const plain = segs.filter((seg) => !isIndex(seg)).join('.');
  const label = FIELD_LABELS[plain];
  if (label) return { where: label, field: label };
  const group = GROUP_LABELS.find(([prefix]) => plain.startsWith(prefix));
  if (group) return { where: group[1], field: group[1] };
  return { where: path };
}

const sentence = (text: string) => {
  const t = text.trim();
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
};

/** A schema (zod) message as a sentence someone who has never seen the JSON can act on. */
export function plainMessage(message: string, path = ''): string {
  let m: RegExpExecArray | null;
  if (/^String must contain at least 1 character/.test(message)) return 'This cannot be blank.';
  if (/^Array must contain at least 1 element/.test(message)) {
    if (path === 'tags.trainingLevels') return 'Pick at least one training level.';
    if (path === 'tags.topics') return 'Pick a curriculum area or add a topic.';
    return 'Add at least one.';
  }
  if ((m = /^Number must be greater than or equal to (-?[\d.]+)/.exec(message))) return `Must be ${m[1]} or more.`;
  if ((m = /^Number must be less than or equal to (-?[\d.]+)/.exec(message))) return `Must be ${m[1]} or less.`;
  if ((m = /^Number must be greater than (-?[\d.]+)/.exec(message))) return `Must be more than ${m[1]}.`;
  if ((m = /^Number must be less than (-?[\d.]+)/.exec(message))) return `Must be less than ${m[1]}.`;
  if (/^Expected integer/.test(message)) return 'Must be a whole number.';
  if (message === 'Required' || /^Expected \w+, received (nan|undefined|null)/.test(message)) {
    return 'A value is needed here.';
  }
  if (/^Invalid enum value/.test(message)) return 'This is not one of the available choices. Pick one from the list.';
  if (/^ids must be lowercase/.test(message)) {
    return 'Use only lowercase letters, numbers, dashes and underscores, starting with a letter or number.';
  }
  if ((m = /^pulse pressure must be at least (\d+) mmHg/.exec(message))) {
    return `Diastolic BP must be at least ${m[1]} mmHg below systolic BP.`;
  }
  if (/^rubric references unknown action/.test(message)) {
    return 'It includes an action that no longer exists. Open Scoring and unlink it.';
  }
  if (/^action references unknown phase/.test(message)) {
    return 'It is placed in a phase that no longer exists. Open its details and pick a phase.';
  }
  if ((m = /^duplicate event id "(.*)"/.exec(message))) {
    return `Another event has the same ID (“${m[1]}”). Change one of them under Advanced, Edit JSON.`;
  }
  if (/^event references unknown action/.test(message)) {
    return 'It is linked to an action that no longer exists. Remove the link under Advanced, Edit JSON.';
  }
  return sentence(message);
}

/** Split a `validateScenario` error ("dot.path: message") into its two parts. */
function splitIssue(issue: string): { path: string; message: string } {
  const colon = issue.indexOf(': ');
  if (colon <= 0 || /\s/.test(issue.slice(0, colon))) return { path: '', message: issue };
  return { path: issue.slice(0, colon), message: issue.slice(colon + 2) };
}

/**
 * Everything standing between this case and a session: schema errors first
 * (they block saving), then the authoring notes, each in rail order.
 */
export function readinessItems(scenario: Scenario, errors: string[], warnings: LintWarning[]): ReadinessItem[] {
  const fixes = errors.map((issue): ReadinessItem => {
    const { path, message } = splitIssue(issue);
    if (!path) return { level: 'fix', section: null, where: '', message: sentence(message), path };
    return { level: 'fix', section: sectionOfPath(path), path, message: plainMessage(message, path), ...place(path, scenario) };
  });
  const looks = warnings.map(
    (w): ReadinessItem => ({
      level: 'look',
      section: sectionOfPath(w.path),
      path: w.path,
      message: sentence(w.message),
      ...place(w.path, scenario),
    }),
  );
  return [...fixes, ...looks];
}

/** Items on one rail section. */
export function itemsFor(items: ReadinessItem[], section: SectionId): ReadinessItem[] {
  return items.filter((item) => item.section === section);
}
