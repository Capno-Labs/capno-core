import { describe, expect, it } from 'vitest';
import { lintScenario } from './lint';
import { parseScenario } from './schema';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';

import anaphylaxis from '@/scenarios/anaphylaxis.json';

const clone = () => parseScenario(JSON.parse(JSON.stringify(anaphylaxis)));

describe('lintScenario', () => {
  it('raises no warning-severity findings for any built-in scenario', () => {
    for (const s of BUILT_IN_SCENARIOS) {
      const warnings = lintScenario(s).filter((w) => w.severity === 'warning');
      expect(warnings, `${s.id}: ${warnings.map((w) => w.path).join(', ')}`).toEqual([]);
    }
  });

  it('flags a phase hint that matches no phase id', () => {
    const s = clone();
    s.events[1].phaseHint = 'no-such-phase';
    const found = lintScenario(s).find((w) => w.path === 'events.1.phaseHint');
    expect(found?.severity).toBe('warning');
    expect(found?.message).toContain('no-such-phase');
  });

  it('flags an auto event scheduled after the estimated run time', () => {
    const s = clone();
    const i = s.events.findIndex((e) => e.autoAtSec !== undefined);
    s.events[i].autoAtSec = s.estimatedMinutes * 60 + 1;
    const found = lintScenario(s).find((w) => w.path === `events.${i}.autoAtSec`);
    expect(found?.severity).toBe('warning');
  });

  it('notes marker events with no effects as info, not warning', () => {
    const s = clone();
    const i = s.events.findIndex((e) => e.effects.length === 0);
    expect(i).toBeGreaterThanOrEqual(0); // cefazolin-given is a marker event
    const found = lintScenario(s).find((w) => w.path === `events.${i}.effects`);
    expect(found?.severity).toBe('info');
  });

  it('notes an auto time of 0 (fires at scenario start) as info', () => {
    const s = clone();
    s.events[0].autoAtSec = 0;
    const found = lintScenario(s).find((w) => w.path === 'events.0.autoAtSec');
    expect(found?.severity).toBe('info');
  });

  it('notes automatic events listed out of time order, once per scenario', () => {
    const s = clone();
    const autos = s.events.filter((e) => e.autoAtSec !== undefined);
    expect(autos.length).toBeGreaterThanOrEqual(2);
    // Reverse the auto-fire times so every adjacent pair is out of order.
    const times = autos.map((e) => e.autoAtSec).reverse();
    autos.forEach((e, k) => {
      e.autoAtSec = times[k];
    });
    const found = lintScenario(s).filter((w) => w.message.includes('out of time order'));
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
  });

  it('returns nothing for a clean faculty-fired event with effects', () => {
    const s = clone();
    const i = s.events.findIndex(
      (e) => e.autoAtSec === undefined && e.effects.length > 0 && e.phaseHint !== undefined,
    );
    expect(i).toBeGreaterThanOrEqual(0);
    expect(lintScenario(s).filter((w) => w.path.startsWith(`events.${i}.`))).toEqual([]);
  });
});
