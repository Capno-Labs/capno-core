import type { ArchivedSession } from '../engine/types';
import { deriveActionOutcomes, isGap, type ActionOutcome } from './actionOutcomes';
import { DECK_COPY, type DeckPhaseId } from './deckCopy';
import { deriveTurningPoints, type TurningPoint } from './turningPoints';

/**
 * The debrief walkthrough as data: one card at a time, in PEARLS order (see
 * deckCopy.ts). Pure — every card is assembled from what the archive already
 * holds (the authored scenario, faculty marks, the log) plus static
 * facilitation wording. Nothing clinical is generated and the stored score
 * is never read.
 */

interface CardBase {
  /** Stable within one deck — React key and test handle. */
  id: string;
  phase: DeckPhaseId;
  /** Facilitator cue, hidden until faculty ask for it (presenter notes). */
  cue?: string;
}

export type DeckCard = CardBase &
  (
    | { kind: 'scene'; title: string; learners: string[] }
    /** A big question for the room: display headline plus follow-ups. */
    | { kind: 'prompt'; headline: readonly string[]; prompts: readonly string[] }
    | { kind: 'timeline'; points: TurningPoint[]; omitted: number }
    | {
        kind: 'list';
        eyebrow: string;
        heading: string;
        items: string[];
        /** Number the first item starts at when a list spans several cards. */
        start: number;
        part?: { n: number; of: number };
      }
    | { kind: 'plusDelta' }
    | { kind: 'doneWell'; outcomes: ActionOutcome[] }
    | { kind: 'gap'; outcome: ActionOutcome; n: number; of: number }
    | { kind: 'otherGaps'; outcomes: ActionOutcome[] }
    | { kind: 'question'; text: string; n: number; of: number }
    | { kind: 'takeaways' }
    | { kind: 'end' }
  );

export type DeckInput = Pick<ArchivedSession, 'scenario' | 'snapshot' | 'history' | 'learnerNames'>;

/** Most key moments one card can hold and still be read from the back row. */
export const MAX_KEY_MOMENTS = 10;

/**
 * Lower is kept first when the timeline has more than fits on a card: the
 * events faculty fired are the story (its resolution included), so they
 * outrank what the monitor did in response.
 */
function momentRank(p: TurningPoint): number {
  if (p.severity === 'critical') return 0;
  if (p.kind === 'event') return 1;
  if (p.kind === 'rhythm') return 2;
  if (p.kind === 'recovery') return 3;
  if (p.kind === 'alarm') return 4;
  return 5; // phase changes
}

/** The moments that carry the story, in time order, capped to one card. */
export function pickKeyMoments(
  points: TurningPoint[],
  max = MAX_KEY_MOMENTS,
): { points: TurningPoint[]; omitted: number } {
  if (points.length <= max) return { points, omitted: 0 };
  const kept = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => momentRank(a.p) - momentRank(b.p) || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map(({ p }) => p);
  return { points: kept, omitted: points.length - kept.length };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** List cards for authored text, split so no card needs scrolling. */
function listCards(
  idPrefix: string,
  phase: DeckPhaseId,
  copy: { eyebrow: string; heading: string; cue: string },
  items: readonly string[],
  perCard: number,
): DeckCard[] {
  const filled = items.filter((s) => s.trim() !== '');
  const parts = chunk(filled, perCard);
  return parts.map((part, i) => ({
    id: `${idPrefix}-${i + 1}`,
    phase,
    kind: 'list' as const,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    items: part,
    start: i * perCard + 1,
    ...(parts.length > 1 ? { part: { n: i + 1, of: parts.length } } : {}),
    cue: copy.cue,
  }));
}

export function buildDebriefDeck(session: DeckInput): DeckCard[] {
  const { scenario } = session;
  const cards: DeckCard[] = [];

  // ── Setting the scene ──────────────────────────────────────────────────
  cards.push({
    id: 'scene',
    phase: 'scene',
    kind: 'scene',
    title: scenario.title,
    learners: session.learnerNames ?? [],
    cue: DECK_COPY.scene.cue,
  });

  // ── Reactions ──────────────────────────────────────────────────────────
  cards.push({
    id: 'reactions',
    phase: 'reactions',
    kind: 'prompt',
    headline: DECK_COPY.reactions.headline,
    prompts: DECK_COPY.reactions.prompts,
    cue: DECK_COPY.reactions.cue,
  });

  // ── Description ────────────────────────────────────────────────────────
  cards.push({
    id: 'description',
    phase: 'description',
    kind: 'prompt',
    headline: DECK_COPY.description.headline,
    prompts: DECK_COPY.description.prompts,
    cue: DECK_COPY.description.cue,
  });
  const moments = pickKeyMoments(deriveTurningPoints(session));
  if (moments.points.length > 0) {
    cards.push({
      id: 'timeline',
      phase: 'description',
      kind: 'timeline',
      ...moments,
      cue: DECK_COPY.timeline.cue,
    });
  }

  // ── Analysis ───────────────────────────────────────────────────────────
  cards.push(
    ...listCards('objectives', 'analysis', DECK_COPY.objectives, scenario.learningObjectives, 6),
  );
  cards.push({ id: 'plus-delta', phase: 'analysis', kind: 'plusDelta', cue: DECK_COPY.plusDelta.cue });

  const outcomes = deriveActionOutcomes(session);
  // A checklist with no critical flags (an imported rubric) has nothing to
  // single out, so everything done counts and every gap shares one card.
  const hasCritical = outcomes.some((o) => o.action.critical);
  const doneWell = outcomes.filter((o) => !isGap(o) && (o.action.critical || !hasCritical));
  if (doneWell.length > 0) {
    cards.push({
      id: 'done-well',
      phase: 'analysis',
      kind: 'doneWell',
      outcomes: doneWell,
      cue: DECK_COPY.doneWell.cue,
    });
  }
  const criticalGaps = outcomes.filter((o) => isGap(o) && o.action.critical);
  criticalGaps.forEach((outcome, i) => {
    cards.push({
      id: `gap-${outcome.action.id}`,
      phase: 'analysis',
      kind: 'gap',
      outcome,
      n: i + 1,
      of: criticalGaps.length,
      cue: DECK_COPY.gap.cue,
    });
  });
  const otherGaps = outcomes.filter((o) => isGap(o) && !o.action.critical);
  if (otherGaps.length > 0) {
    cards.push({
      id: 'other-gaps',
      phase: 'analysis',
      kind: 'otherGaps',
      outcomes: otherGaps,
      cue: DECK_COPY.otherGaps.cue,
    });
  }

  const questions = scenario.debrief.questions.filter((q) => q.trim() !== '');
  questions.forEach((text, i) => {
    cards.push({
      id: `question-${i + 1}`,
      phase: 'analysis',
      kind: 'question',
      text,
      n: i + 1,
      of: questions.length,
      cue: DECK_COPY.question.cue,
    });
  });

  cards.push(...listCards('points', 'analysis', DECK_COPY.points, scenario.debrief.points, 3));
  cards.push(
    ...listCards('management', 'analysis', DECK_COPY.management, scenario.correctManagement, 5),
  );
  cards.push(...listCards('errors', 'analysis', DECK_COPY.errors, scenario.commonErrors, 5));
  cards.push({
    id: 'outstanding',
    phase: 'analysis',
    kind: 'prompt',
    headline: DECK_COPY.outstanding.headline,
    prompts: DECK_COPY.outstanding.prompts,
    cue: DECK_COPY.outstanding.cue,
  });

  // ── Summary ────────────────────────────────────────────────────────────
  cards.push({ id: 'takeaways', phase: 'summary', kind: 'takeaways', cue: DECK_COPY.takeaways.cue });
  cards.push({ id: 'end', phase: 'summary', kind: 'end' });

  return cards;
}
