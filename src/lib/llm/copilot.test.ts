import { describe, expect, it } from 'vitest';
import type { Scenario, SimSnapshot } from '../engine/types';
import { DEFAULT_VITALS } from '../engine/vitals';
import {
  applyCopilotCommand,
  buildCopilotMessages,
  extractJson,
  parseCopilotResponse,
  runCopilot,
  type CopilotActions,
} from './copilot';
import type { LlmProvider, LlmRequest } from './types';

function fixtureScenario(): Scenario {
  return {
    id: 'test',
    version: '1.0.0',
    title: 'Test',
    summary: 'test',
    tags: { topics: ['t'], difficulty: 'beginner', trainingLevels: ['srna'] },
    learningObjectives: ['x'],
    setup: [],
    patient: {
      name: 'T',
      age: 30,
      sex: 'female',
      weightKg: 70,
      heightCm: 170,
      asa: 1,
      allergies: [],
      medications: [],
      pmh: [],
      airway: { mallampati: 1 },
    },
    baselineVitals: { ...DEFAULT_VITALS },
    phases: [
      { id: 'main', label: 'Main phase' },
      { id: 'crisis', label: 'Crisis' },
    ],
    events: [
      { id: 'anaphylaxis-full', label: 'Full anaphylaxis', category: 'circulation', effects: [] },
      { id: 'epi-response', label: 'Response to epinephrine', category: 'resolution', effects: [] },
    ],
    expectedActions: [{ id: 'give-epi', label: 'Give epinephrine', critical: true, points: 20 }],
    expectedProgression: [],
    correctManagement: [],
    commonErrors: [],
    debrief: { points: [], questions: [] },
    rubric: [],
    estimatedMinutes: 10,
  };
}

function fixtureSnapshot(): SimSnapshot {
  return {
    scenarioId: 'test',
    sessionId: 'ABCD',
    status: 'running',
    elapsedSec: 120,
    phaseId: 'main',
    vitals: { ...DEFAULT_VITALS },
    nibp: null,
    alarms: [],
    alarmsSilenced: false,
    actions: [{ actionId: 'give-epi', status: 'pending' }],
    log: [],
    notes: [],
    firedEventIds: ['anaphylaxis-full'],
  };
}

/** Queue-backed fake provider that records every request it receives. */
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

describe('extractJson', () => {
  it('passes plain JSON through', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });
  it('strips markdown fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('trims surrounding prose', () => {
    expect(extractJson('Sure! Here you go: {"a":1} Hope that helps.')).toBe('{"a":1}');
  });
});

describe('parseCopilotResponse', () => {
  const scenario = fixtureScenario();

  it('produces proposals with labels from scenario data', () => {
    const result = parseCopilotResponse(
      JSON.stringify({
        commands: [
          { type: 'set_vital', key: 'sbp', target: 62, overSec: 120 },
          { type: 'set_rhythm', rhythm: 'sinus_tach' },
          { type: 'trigger_event', eventId: 'epi-response' },
          { type: 'set_phase', phaseId: 'crisis' },
          { type: 'mark_action', actionId: 'give-epi', status: 'done' },
          { type: 'cycle_nibp' },
        ],
      }),
      scenario,
    );
    expect(result.errors).toEqual([]);
    expect(result.proposals.map((p) => p.label)).toEqual([
      'SBP → 62 mmHg over 120 s',
      'Rhythm → Sinus Tachycardia',
      'Fire event: Response to epinephrine',
      'Phase → Crisis',
      'Mark "Give epinephrine" as done',
      'Cycle NIBP now',
    ]);
    expect(result.proposals.every((p) => p.warnings.length === 0)).toBe(true);
  });

  it('clamps out-of-range vitals with a warning instead of rejecting', () => {
    const result = parseCopilotResponse(
      JSON.stringify({ commands: [{ type: 'set_vital', key: 'hr', target: 500, overSec: 0 }] }),
      scenario,
    );
    expect(result.errors).toEqual([]);
    expect(result.proposals[0].command).toEqual({
      type: 'set_vital',
      key: 'hr',
      target: 220,
      overSec: 0,
    });
    expect(result.proposals[0].label).toBe('HR → 220 bpm (instant)');
    expect(result.proposals[0].warnings[0]).toMatch(/clamped to 220/);
  });

  it('respects vital decimals when rounding', () => {
    const result = parseCopilotResponse(
      JSON.stringify({ commands: [{ type: 'set_vital', key: 'temp', target: 39.87 }] }),
      scenario,
    );
    expect(result.proposals[0].command).toMatchObject({ target: 39.9, overSec: 20 });
    expect(result.proposals[0].label).toBe('Temp → 39.9 °C over 20 s');
  });

  it('defaults overSec to 20 and clamps huge ramps', () => {
    const result = parseCopilotResponse(
      JSON.stringify({
        commands: [
          { type: 'set_vital', key: 'sbp', target: 90 },
          { type: 'set_vital', key: 'dbp', target: 50, overSec: 100000 },
        ],
      }),
      scenario,
    );
    expect(result.proposals[0].command).toMatchObject({ overSec: 20 });
    expect(result.proposals[1].command).toMatchObject({ overSec: 600 });
    expect(result.proposals[1].warnings[0]).toMatch(/clamped to 600/);
  });

  it('drops unknown ids into errors while keeping valid commands', () => {
    const result = parseCopilotResponse(
      JSON.stringify({
        commands: [
          { type: 'trigger_event', eventId: 'pizza-delivery' },
          { type: 'set_rhythm', rhythm: 'svt' },
        ],
      }),
      scenario,
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Unknown event "pizza-delivery"/);
    expect(result.errors[0]).toMatch(/anaphylaxis-full, epi-response/);
  });

  it('warns when re-firing an already fired event', () => {
    const result = parseCopilotResponse(
      JSON.stringify({ commands: [{ type: 'trigger_event', eventId: 'anaphylaxis-full' }] }),
      scenario,
      ['anaphylaxis-full'],
    );
    expect(result.proposals[0].warnings).toContain('already fired — will re-fire');
  });

  it('rejects unknown command types but keeps the rest of the batch', () => {
    const result = parseCopilotResponse(
      JSON.stringify({
        commands: [{ type: 'launch_rocket' }, { type: 'set_rhythm', rhythm: 'afib' }],
      }),
      scenario,
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.errors[0]).toMatch(/launch_rocket/);
  });

  it('handles fenced JSON responses', () => {
    const result = parseCopilotResponse(
      '```json\n{"commands":[{"type":"set_rhythm","rhythm":"vfib"}]}\n```',
      scenario,
    );
    expect(result.proposals[0].label).toBe('Rhythm → Ventricular Fibrillation');
  });

  it('returns errors and no proposals for garbage', () => {
    const result = parseCopilotResponse('the patient is fine', scenario);
    expect(result.proposals).toEqual([]);
    expect(result.errors[0]).toMatch(/parse/i);
  });

  it('surfaces a reply-only response', () => {
    const result = parseCopilotResponse(
      JSON.stringify({ commands: [], reply: 'Session reset is not available.' }),
      scenario,
    );
    expect(result.proposals).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.reply).toBe('Session reset is not available.');
  });

  it('rejects empty notes and truncates long ones', () => {
    const long = 'x'.repeat(600);
    const result = parseCopilotResponse(
      JSON.stringify({
        commands: [
          { type: 'add_note', text: '   ' },
          { type: 'add_note', text: long },
        ],
      }),
      scenario,
    );
    expect(result.errors[0]).toMatch(/empty text/);
    expect(result.proposals[0].command).toMatchObject({ text: 'x'.repeat(500) });
    expect(result.proposals[0].warnings[0]).toMatch(/truncated/);
  });

  it('clamps skip_ahead into 1–600 s', () => {
    const result = parseCopilotResponse(
      JSON.stringify({ commands: [{ type: 'skip_ahead', sec: -5 }] }),
      scenario,
    );
    expect(result.proposals[0].command).toMatchObject({ sec: 1 });
  });
});

describe('buildCopilotMessages', () => {
  it('includes ids, labels, fired flags, and the request', () => {
    const messages = buildCopilotMessages(fixtureScenario(), fixtureSnapshot(), 'crash the patient');
    expect(messages[0].role).toBe('system');
    const user = messages[1].content;
    expect(user).toContain('"anaphylaxis-full"');
    expect(user).toContain('"fired":true');
    expect(user).toContain('"give-epi"');
    expect(user).toContain('REQUEST: crash the patient');
    // Teaching content must not leak into the prompt context.
    expect(user).not.toContain('effects');
  });
});

describe('runCopilot', () => {
  it('sends jsonMode and parses against the live fired list', async () => {
    const provider = new FakeProvider([
      JSON.stringify({ commands: [{ type: 'trigger_event', eventId: 'anaphylaxis-full' }] }),
    ]);
    const result = await runCopilot(provider, fixtureScenario(), fixtureSnapshot(), 'again');
    expect(provider.requests[0].jsonMode).toBe(true);
    expect(result.proposals[0].warnings).toContain('already fired — will re-fire');
  });

  it('converts provider failures into errors', async () => {
    const provider = new FakeProvider([]);
    const result = await runCopilot(provider, fixtureScenario(), fixtureSnapshot(), 'hi');
    expect(result.proposals).toEqual([]);
    expect(result.errors[0]).toMatch(/queue empty/);
  });
});

describe('applyCopilotCommand', () => {
  it('dispatches each command to the matching action', () => {
    const calls: string[] = [];
    const actions: CopilotActions = {
      setVital: (k, v, o) => calls.push(`setVital:${k}:${v}:${o}`),
      setRhythm: (r) => calls.push(`setRhythm:${r}`),
      triggerEvent: (id) => calls.push(`triggerEvent:${id}`),
      setPhase: (id) => calls.push(`setPhase:${id}`),
      markAction: (id, s) => calls.push(`markAction:${id}:${s}`),
      addNote: (t) => calls.push(`addNote:${t}`),
      skipAhead: (s) => calls.push(`skipAhead:${s}`),
      cycleNibp: () => calls.push('cycleNibp'),
    };
    applyCopilotCommand({ type: 'set_vital', key: 'hr', target: 135, overSec: 60 }, actions);
    applyCopilotCommand({ type: 'set_rhythm', rhythm: 'sinus_tach' }, actions);
    applyCopilotCommand({ type: 'trigger_event', eventId: 'e' }, actions);
    applyCopilotCommand({ type: 'set_phase', phaseId: 'p' }, actions);
    applyCopilotCommand({ type: 'mark_action', actionId: 'a', status: 'done' }, actions);
    applyCopilotCommand({ type: 'add_note', text: 'n' }, actions);
    applyCopilotCommand({ type: 'skip_ahead', sec: 60 }, actions);
    applyCopilotCommand({ type: 'cycle_nibp' }, actions);
    expect(calls).toEqual([
      'setVital:hr:135:60',
      'setRhythm:sinus_tach',
      'triggerEvent:e',
      'setPhase:p',
      'markAction:a:done',
      'addNote:n',
      'skipAhead:60',
      'cycleNibp',
    ]);
  });
});
