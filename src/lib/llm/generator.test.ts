import { describe, expect, it } from 'vitest';
import inductionHypotension from '@/scenarios/induction-hypotension.json';
import type { Scenario } from '../engine/types';
import {
  AI_GENERATED_TAG,
  DOCUMENT_CHAR_LIMIT,
  buildGeneratorMessages,
  condenseExample,
  generateScenario,
  postProcess,
  prepareDocument,
} from './generator';
import type { LlmProvider, LlmRequest } from './types';

/** Deep-cloned valid scenario to mutate into canned responses. */
function validDraft(overrides?: Partial<Scenario>): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(inductionHypotension)) as Record<string, unknown>;
  return { ...base, id: 'test-draft', title: 'Test draft', ...overrides };
}

class FakeProvider implements LlmProvider {
  readonly kind = 'fake' as const;
  requests: LlmRequest[] = [];
  constructor(private responses: string[]) {}
  async complete(request: LlmRequest): Promise<string> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (next === undefined) throw new Error('FakeProvider queue empty');
    return next;
  }
}

describe('generateScenario', () => {
  it('succeeds on the first attempt and tags the draft', async () => {
    const provider = new FakeProvider([JSON.stringify(validDraft())]);
    const result = await generateScenario(provider, 'a hypotension case');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(1);
    expect(result.scenario.id).toBe('test-draft');
    // Appended, never prepended: topics[0] stays the curriculum domain.
    expect(result.scenario.tags.topics.at(-1)).toBe(AI_GENERATED_TAG);
    expect(result.scenario.tags.topics[0]).not.toBe(AI_GENERATED_TAG);
  });

  it('repairs after a referential-integrity failure, feeding errors back verbatim', async () => {
    const broken = validDraft();
    (broken.rubric as { actionIds: string[] }[])[0].actionIds = ['ghost-action'];
    const provider = new FakeProvider([JSON.stringify(broken), JSON.stringify(validDraft())]);

    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);

    // The second request must carry the first response + the exact validation errors.
    const second = provider.requests[1];
    const repair = second.messages[second.messages.length - 1];
    expect(repair.role).toBe('user');
    expect(repair.content).toMatch(/failed validation/);
    expect(repair.content).toMatch(/ghost-action/);
    expect(second.messages[second.messages.length - 2].role).toBe('assistant');
  });

  it('feeds JSON syntax errors back', async () => {
    const provider = new FakeProvider(['{not json at all', JSON.stringify(validDraft())]);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
    expect(provider.requests[1].messages.at(-1)?.content).toMatch(/Invalid JSON/);
  });

  it('gives up after maxAttempts with errors and raw text', async () => {
    const broken = JSON.stringify(validDraft({ phases: [] }));
    const provider = new FakeProvider([broken, broken, broken]);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.attempts).toBe(3);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.rawText).toBe(broken);
  });

  it('handles fenced output', async () => {
    const provider = new FakeProvider(['```json\n' + JSON.stringify(validDraft()) + '\n```']);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
  });

  it('reports attempts via onAttempt and provider failures as errors', async () => {
    const attempts: number[] = [];
    const provider = new FakeProvider([]);
    const result = await generateScenario(provider, 'x', { onAttempt: (a) => attempts.push(a) });
    expect(attempts).toEqual([1]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/queue empty/);
  });
});

describe('postProcess', () => {
  it('suffixes ids that collide with built-ins', async () => {
    const provider = new FakeProvider([JSON.stringify(validDraft({ id: 'anaphylaxis' }))]);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.id).toBe('anaphylaxis-ai');
  });

  it('suffixes the reserved quick-start id so a draft cannot shadow the pinned freeform session', async () => {
    const provider = new FakeProvider([JSON.stringify(validDraft({ id: 'quick-start' }))]);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.id).toBe('quick-start-ai');
  });

  it('does not duplicate the ai-generated tag', async () => {
    const draft = validDraft();
    (draft.tags as { topics: string[] }).topics = [AI_GENERATED_TAG, 'hypotension'];
    const provider = new FakeProvider([JSON.stringify(draft)]);
    const result = await generateScenario(provider, 'x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tags = result.scenario.tags.topics.filter((t) => t === AI_GENERATED_TAG);
    expect(tags).toHaveLength(1);
  });
});

describe('prompt assembly', () => {
  it('embeds the schema reference and a condensed example', () => {
    const [system, user] = buildGeneratorMessages('MH crisis, intermediate');
    expect(system.role).toBe('system');
    expect(system.content).toMatch(/rubric\[\].actionIds entry MUST/);
    expect(system.content).toContain('"induction-hypotension"');
    expect(user.content).toBe('Create a scenario: MH crisis, intermediate');
  });

  it('wraps a grounding document in the user message with verbatim-dose rules', () => {
    const [system, user] = buildGeneratorMessages('the OB lab', 'Week 3: PPH lab.\nOxytocin 40 units in 500 mL.');
    expect(system.content).toMatch(/SOURCE DOCUMENT/);
    expect(system.content).toMatch(/use them verbatim/);
    expect(user.content).toMatch(/Create a scenario: the OB lab/);
    expect(user.content).toContain('Oxytocin 40 units in 500 mL.');
  });

  it('omits document rules entirely when no document is supplied', () => {
    const [system, user] = buildGeneratorMessages('MH crisis');
    expect(system.content).not.toMatch(/SOURCE DOCUMENT/);
    expect(user.content).not.toMatch(/SOURCE DOCUMENT/);
  });

  it('prepareDocument normalizes line endings and truncates at the limit', () => {
    expect(prepareDocument('a\r\nb  \nc\r')).toEqual({ text: 'a\nb\nc', truncated: false });
    const long = prepareDocument('x'.repeat(DOCUMENT_CHAR_LIMIT + 5));
    expect(long.truncated).toBe(true);
    expect(long.text).toHaveLength(DOCUMENT_CHAR_LIMIT);
  });

  it('condenseExample truncates long teaching arrays but keeps structure', () => {
    const scenario = JSON.parse(JSON.stringify(inductionHypotension)) as Scenario;
    const condensed = condenseExample(scenario) as Scenario;
    expect(condensed.correctManagement.length).toBeLessThanOrEqual(3);
    expect(condensed.events).toEqual(scenario.events);
    expect(condensed.expectedActions).toEqual(scenario.expectedActions);
  });
});

describe('postProcess (pure)', () => {
  it('leaves non-colliding ids alone', () => {
    const scenario = { ...(JSON.parse(JSON.stringify(inductionHypotension)) as Scenario), id: 'my-case' };
    expect(postProcess(scenario).id).toBe('my-case');
  });
});
