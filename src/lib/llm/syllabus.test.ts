import { describe, expect, it } from 'vitest';
import { MAX_LABS, buildExtractionMessages, extractSyllabusLabs } from './syllabus';
import type { LlmProvider, LlmRequest } from './types';

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

const LABS = {
  labs: [
    { title: 'Week 3 — PPH', prompt: 'Postpartum hemorrhage after vaginal delivery, CA-1 level.' },
    { title: 'Week 5 — MH', prompt: 'Malignant hyperthermia during sevoflurane anesthetic.' },
  ],
};

describe('extractSyllabusLabs', () => {
  it('succeeds on the first attempt and embeds the document verbatim', async () => {
    const provider = new FakeProvider([JSON.stringify(LABS)]);
    const result = await extractSyllabusLabs(provider, 'Week 3: PPH lab. Week 5: MH lab.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.labs).toHaveLength(2);
    expect(result.attempts).toBe(1);
    expect(provider.requests[0].messages.at(-1)?.content).toContain('Week 5: MH lab.');
    expect(provider.requests[0].jsonMode).toBe(true);
  });

  it('repairs after malformed JSON, feeding errors back', async () => {
    const provider = new FakeProvider(['{oops', JSON.stringify(LABS)]);
    const result = await extractSyllabusLabs(provider, 'doc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(provider.requests[1].messages.at(-1)?.content).toMatch(/Invalid JSON/);
  });

  it('repairs after a schema failure (empty labs)', async () => {
    const provider = new FakeProvider([JSON.stringify({ labs: [] }), JSON.stringify(LABS)]);
    const result = await extractSyllabusLabs(provider, 'doc');
    expect(result.ok).toBe(true);
    expect(provider.requests[1].messages.at(-1)?.content).toMatch(/labs/);
  });

  it('rejects more than MAX_LABS entries via the schema', async () => {
    const tooMany = {
      labs: Array.from({ length: MAX_LABS + 1 }, (_, i) => ({ title: `t${i}`, prompt: `p${i}` })),
    };
    const provider = new FakeProvider([JSON.stringify(tooMany), JSON.stringify(LABS)]);
    const result = await extractSyllabusLabs(provider, 'doc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
  });

  it('gives up after maxAttempts with the last errors', async () => {
    const provider = new FakeProvider(['{a', '{b', '{c']);
    const result = await extractSyllabusLabs(provider, 'doc');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.attempts).toBe(3);
    expect(result.errors[0]).toMatch(/Invalid JSON/);
  });

  it('surfaces provider failures as errors', async () => {
    const provider = new FakeProvider([]);
    const result = await extractSyllabusLabs(provider, 'doc');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/queue empty/);
  });
});

describe('buildExtractionMessages', () => {
  it('is extraction-only by instruction', () => {
    const [system] = buildExtractionMessages('doc');
    expect(system.content).toMatch(/Do NOT invent clinical content/);
    expect(system.content).toContain(`${MAX_LABS}`);
  });
});
