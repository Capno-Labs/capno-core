import { describe, expect, it } from 'vitest';

import type { ActionRecord, ActionStatus, LogEntry, Scenario, SimSnapshot } from '../engine/types';
import laryngospasm from '../../scenarios/laryngospasm-lma.json';
import { buildDebriefDeck, pickKeyMoments, MAX_KEY_MOMENTS, type DeckCard, type DeckInput } from './deck';
import { DECK_PHASES } from './deckCopy';
import type { TurningPoint } from './turningPoints';

const scenario = laryngospasm as unknown as Scenario;

const marks = (status: ActionStatus, overrides: Record<string, ActionStatus> = {}): ActionRecord[] =>
  scenario.expectedActions.map((a, i) => ({
    actionId: a.id,
    status: overrides[a.id] ?? status,
    markedAtSec: 60 + i * 10,
  }));

const session = (over: {
  scenario?: Scenario;
  actions?: ActionRecord[];
  log?: LogEntry[];
  learnerNames?: string[];
}): DeckInput => ({
  scenario: over.scenario ?? scenario,
  snapshot: { actions: over.actions ?? [], log: over.log ?? [] } as unknown as SimSnapshot,
  ...(over.learnerNames ? { learnerNames: over.learnerNames } : {}),
});

const ofKind = <K extends DeckCard['kind']>(cards: DeckCard[], kind: K) =>
  cards.filter((c): c is Extract<DeckCard, { kind: K }> => c.kind === kind);

const critical = scenario.expectedActions.filter((a) => a.critical);

describe('buildDebriefDeck', () => {
  it('walks the five phases in order without going back', () => {
    const cards = buildDebriefDeck(session({ actions: marks('done') }));
    const order = DECK_PHASES.map((p) => p.id);
    const seen = cards.map((c) => order.indexOf(c.phase));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(cards.map((c) => c.phase))).toEqual(new Set(order));
  });

  it('opens on the scene card and closes on the end card', () => {
    const cards = buildDebriefDeck(session({ actions: marks('done'), learnerNames: ['A. Resident'] }));
    expect(cards[0]).toMatchObject({
      kind: 'scene',
      title: scenario.title,
      learners: ['A. Resident'],
    });
    expect(cards[cards.length - 1].kind).toBe('end');
    expect(cards[cards.length - 2].kind).toBe('takeaways');
  });

  it('gives every card a unique id', () => {
    const cards = buildDebriefDeck(session({}));
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('makes no gap cards when everything was done', () => {
    const cards = buildDebriefDeck(session({ actions: marks('done') }));
    expect(ofKind(cards, 'gap')).toEqual([]);
    expect(ofKind(cards, 'otherGaps')).toEqual([]);
    expect(ofKind(cards, 'doneWell')[0].outcomes.map((o) => o.action.id)).toEqual(
      critical.map((a) => a.id),
    );
  });

  it('makes one gap card per critical action missed, incorrect or delayed', () => {
    const [first, second, third] = critical;
    const cards = buildDebriefDeck(
      session({
        actions: marks('done', {
          [first.id]: 'missed',
          [second.id]: 'delayed',
          [third.id]: 'incorrect',
        }),
      }),
    );
    const gaps = ofKind(cards, 'gap');
    expect(gaps.map((g) => [g.outcome.action.id, g.outcome.status])).toEqual([
      [first.id, 'missed'],
      [second.id, 'delayed'],
      [third.id, 'incorrect'],
    ]);
    expect(gaps.map((g) => `${g.n}/${g.of}`)).toEqual(['1/3', '2/3', '3/3']);
    expect(ofKind(cards, 'doneWell')[0].outcomes).toHaveLength(critical.length - 3);
  });

  it('treats an unmarked session as all missed and drops the done-well card', () => {
    const cards = buildDebriefDeck(session({}));
    expect(ofKind(cards, 'gap')).toHaveLength(critical.length);
    expect(ofKind(cards, 'doneWell')).toEqual([]);
  });

  it('groups non-critical gaps on one card', () => {
    const nonCritical = scenario.expectedActions.filter((a) => !a.critical);
    const cards = buildDebriefDeck(
      session({
        actions: marks('done', Object.fromEntries(nonCritical.map((a) => [a.id, 'missed' as const]))),
      }),
    );
    expect(ofKind(cards, 'gap')).toEqual([]);
    expect(ofKind(cards, 'otherGaps')).toHaveLength(1);
    expect(ofKind(cards, 'otherGaps')[0].outcomes).toHaveLength(nonCritical.length);
  });

  it('with no critical flags, counts everything done and shares one gap card', () => {
    const flat: Scenario = {
      ...scenario,
      expectedActions: scenario.expectedActions.map((a) => ({ ...a, critical: false, points: 0 })),
    };
    const [first] = flat.expectedActions;
    const cards = buildDebriefDeck(
      session({ scenario: flat, actions: marks('done', { [first.id]: 'missed' }) }),
    );
    expect(ofKind(cards, 'gap')).toEqual([]);
    expect(ofKind(cards, 'otherGaps')[0].outcomes.map((o) => o.action.id)).toEqual([first.id]);
    expect(ofKind(cards, 'doneWell')[0].outcomes).toHaveLength(flat.expectedActions.length - 1);
  });

  it('puts each authored question on its own card, in order', () => {
    const cards = buildDebriefDeck(session({ actions: marks('done') }));
    const questions = ofKind(cards, 'question');
    expect(questions.map((q) => q.text)).toEqual(scenario.debrief.questions);
    expect(questions.every((q) => q.of === scenario.debrief.questions.length)).toBe(true);
  });

  it('splits long authored lists across cards and keeps the numbering', () => {
    const cards = buildDebriefDeck(session({ actions: marks('done') }));
    const points = ofKind(cards, 'list').filter((c) => c.id.startsWith('points-'));
    expect(points.flatMap((c) => c.items)).toEqual(scenario.debrief.points);
    expect(points.every((c) => c.items.length <= 3)).toBe(true);
    expect(points.map((c) => c.start)).toEqual(points.map((_, i) => i * 3 + 1));
    expect(points[0].part).toEqual({ n: 1, of: points.length });
  });

  it('leaves out cards the scenario has no content for', () => {
    const bare: Scenario = {
      ...scenario,
      correctManagement: [],
      commonErrors: [],
      debrief: { points: [], questions: ['', '  '] },
    };
    const cards = buildDebriefDeck(session({ scenario: bare, actions: marks('done') }));
    expect(ofKind(cards, 'question')).toEqual([]);
    expect(ofKind(cards, 'timeline')).toEqual([]);
    expect(ofKind(cards, 'list').map((c) => c.id)).toEqual(['objectives-1']);
  });

  it('adds the key-moments card when events were logged', () => {
    const [ev] = scenario.events;
    const cards = buildDebriefDeck(
      session({ actions: marks('done'), log: [{ t: 120, kind: 'event', label: ev.label }] }),
    );
    const [timeline] = ofKind(cards, 'timeline');
    expect(timeline.phase).toBe('description');
    expect(timeline.points.map((p) => p.label)).toEqual([ev.label]);
    expect(timeline.omitted).toBe(0);
  });
});

describe('pickKeyMoments', () => {
  const point = (t: number, over: Partial<TurningPoint> = {}): TurningPoint => ({
    t,
    kind: 'phase',
    severity: 'info',
    label: `p${t}`,
    ...over,
  });

  it('returns everything when it fits', () => {
    const points = [point(1), point(2)];
    expect(pickKeyMoments(points)).toEqual({ points, omitted: 0 });
  });

  it('keeps critical points and events over phase changes, in time order', () => {
    const points = [
      ...Array.from({ length: MAX_KEY_MOMENTS }, (_, i) => point(i)),
      point(100, { kind: 'alarm', severity: 'critical' }),
      point(101, { kind: 'event', severity: 'warning' }),
    ];
    const picked = pickKeyMoments(points);
    expect(picked.points).toHaveLength(MAX_KEY_MOMENTS);
    expect(picked.omitted).toBe(2);
    expect(picked.points.map((p) => p.t)).toEqual([
      ...Array.from({ length: MAX_KEY_MOMENTS - 2 }, (_, i) => i),
      100,
      101,
    ]);
  });

  it('keeps a late event over an earlier rhythm change or alarm', () => {
    const points = [
      ...Array.from({ length: MAX_KEY_MOMENTS }, (_, i) =>
        point(i, i % 2 ? { kind: 'rhythm', severity: 'warning' } : { kind: 'alarm', severity: 'warning' }),
      ),
      point(200, { kind: 'event', severity: 'info', label: 'Full recovery' }),
    ];
    const picked = pickKeyMoments(points);
    expect(picked.points[picked.points.length - 1].label).toBe('Full recovery');
    expect(picked.omitted).toBe(1);
  });
});
