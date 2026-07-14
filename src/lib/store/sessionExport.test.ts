import { describe, expect, it } from 'vitest';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { ArchivedSession, SimSnapshot } from '../engine/types';
import { mergeImported, parseSessionExport, serializeSessions } from './sessionExport';

function makeSession(sessionId: string, endedAtIso: string): ArchivedSession {
  const scenario = BUILT_IN_SCENARIOS[0];
  const snapshot: SimSnapshot = {
    scenarioId: scenario.id,
    sessionId,
    status: 'ended',
    elapsedSec: 300,
    phaseId: scenario.phases[0].id,
    phaseChangedAtSec: 0,
    vitals: { ...scenario.baselineVitals, rhythm: 'sinus' },
    nibp: { sbp: 120, dbp: 70, atSec: 280 },
    alarms: [],
    alarmsSilenced: false,
    actions: scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'done' as const })),
    log: [{ t: 0, kind: 'session', label: 'Session started' }],
    notes: [],
    firedEventIds: [],
    autoEventsEnabled: false,
  };
  return {
    sessionId,
    scenario,
    snapshot,
    endedAtIso,
    score: {
      earned: 10,
      possible: 10,
      percent: 100,
      categories: [],
      criticalMissed: [],
      criticalDone: [],
    },
    history: [{ t: 0, hr: 70, sbp: 120, dbp: 70, spo2: 99, etco2: 36, rr: 12, temp: 36.6 }],
    learnerNames: ['A. Learner'],
  };
}

describe('sessionExport', () => {
  it('round-trips serialize → parse', () => {
    const sessions = [makeSession('AB12', '2026-01-02T10:00:00.000Z')];
    const parsed = parseSessionExport(serializeSessions(sessions));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0].sessionId).toBe('AB12');
      expect(parsed.sessions[0].scenario.id).toBe(sessions[0].scenario.id);
      expect(parsed.sessions[0].history).toHaveLength(1);
      expect(parsed.sessions[0].learnerNames).toEqual(['A. Learner']);
    }
  });

  it('accepts pre-rename labsim-session-export files', () => {
    const sessions = [makeSession('AB12', '2026-01-02T10:00:00.000Z')];
    const legacy = JSON.parse(serializeSessions(sessions));
    legacy.kind = 'labsim-session-export';
    const parsed = parseSessionExport(JSON.stringify(legacy));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.sessions[0].sessionId).toBe('AB12');
  });

  it('rejects non-JSON, wrong envelopes, and invalid embedded scenarios', () => {
    expect(parseSessionExport('not json').ok).toBe(false);
    expect(parseSessionExport('{"kind":"something-else"}').ok).toBe(false);
    expect(
      parseSessionExport(JSON.stringify({ kind: 'capno-session-export', formatVersion: 1 })).ok,
    ).toBe(false);

    const bad = makeSession('CD34', '2026-01-02T10:00:00.000Z');
    const tampered = JSON.parse(serializeSessions([bad]));
    tampered.sessions[0].scenario = { id: 'broken' };
    const result = parseSessionExport(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it('merge: local record wins on sessionId collision', () => {
    const local = makeSession('AB12', '2026-01-01T09:00:00.000Z');
    local.learnerNames = ['Local Truth'];
    const imported = makeSession('AB12', '2026-01-01T09:00:00.000Z');
    imported.learnerNames = ['Imported Copy'];

    const { merged, added, skipped } = mergeImported([local], [imported]);
    expect(merged).toHaveLength(1);
    expect(merged[0].learnerNames).toEqual(['Local Truth']);
    expect(added).toBe(0);
    expect(skipped).toBe(1);
  });

  it('merge: adds new sessions newest-first and keeps local under the cap', () => {
    const existing = Array.from({ length: 48 }, (_, i) =>
      makeSession(`L${i}`, `2026-03-${String((i % 27) + 1).padStart(2, '0')}T00:00:00.000Z`),
    );
    const imported = Array.from({ length: 5 }, (_, i) =>
      makeSession(`I${i}`, `2026-04-0${i + 1}T00:00:00.000Z`),
    );

    const { merged, added, skipped } = mergeImported(existing, imported);
    expect(merged).toHaveLength(50);
    expect(added).toBe(2); // only 2 free slots
    expect(skipped).toBe(3);
    // Every local session survives.
    for (const s of existing) {
      expect(merged.some((m) => m.sessionId === s.sessionId)).toBe(true);
    }
    // Newest-first ordering.
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].endedAtIso >= merged[i].endedAtIso).toBe(true);
    }
  });
});
