import { describe, expect, it } from 'vitest';
import { SimulationEngine } from './engine';
import { clampVital } from './vitals';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { NumericVitals, Scenario } from './types';

const scenario = (): Scenario => BUILT_IN_SCENARIOS[0];

function newEngine() {
  return new SimulationEngine(scenario(), 'TEST');
}

describe('SimulationEngine', () => {
  it('starts idle at baseline vitals', () => {
    const e = newEngine();
    expect(e.getStatus()).toBe('idle');
    expect(e.getElapsedSec()).toBe(0);
    expect(e.getVitals().hr).toBe(scenario().baselineVitals.hr);
  });

  it('does not advance time unless running', () => {
    const e = newEngine();
    e.tick(10);
    expect(e.getElapsedSec()).toBe(0);
    e.start();
    e.tick(10);
    expect(e.getElapsedSec()).toBe(10);
    e.pause();
    e.tick(10);
    expect(e.getElapsedSec()).toBe(10);
  });

  it('ramps a vital linearly toward its target', () => {
    const e = newEngine();
    e.start();
    const startHr = e.getVitals().hr;
    e.setVital('hr', startHr + 40, 40); // +1 bpm/sec
    e.tick(10);
    expect(e.getVitals().hr).toBeCloseTo(startHr + 10, 0);
    e.tick(30);
    expect(e.getVitals().hr).toBe(startHr + 40);
    e.tick(60); // does not overshoot
    expect(e.getVitals().hr).toBe(startHr + 40);
  });

  it('applies instant vital changes when overSec is 0', () => {
    const e = newEngine();
    e.start();
    e.setVital('spo2', 80, 0);
    expect(e.getVitals().spo2).toBe(80);
  });

  it('clamps vital targets to display ranges', () => {
    const e = newEngine();
    e.start();
    e.setVital('spo2', 250, 0);
    expect(e.getVitals().spo2).toBe(100);
  });

  it('triggers events with delayed effects', () => {
    const e = newEngine();
    e.start();
    const ev = e.scenario.events.find((x) => x.effects.length > 0)!;
    e.triggerEvent(ev.id);
    const snap = e.snapshot();
    expect(snap.firedEventIds).toContain(ev.id);
    expect(snap.log.some((l) => l.kind === 'event' && l.label === ev.label)).toBe(true);
  });

  it('manually firing an auto event early cancels its scheduled copy', () => {
    const e = newEngine();
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined && x.autoAtSec > 30);
    if (!auto) return;
    const firstVitalEffect = auto.effects.find((f) => f.vitals);
    const targetKey = firstVitalEffect
      ? (Object.keys(firstVitalEffect.vitals!)[0] as keyof NumericVitals)
      : null;
    e.start();
    e.tick(10);
    e.triggerEvent(auto.id); // faculty fires it early from the Flow panel
    // Faculty overrides a vital the event touched; the scheduled auto copy
    // must NOT re-apply at autoAtSec and stomp the override.
    const override = targetKey ? clampVital(targetKey, 42) : 0;
    if (targetKey) e.setVital(targetKey, override, 0);
    e.tick(auto.autoAtSec! + 60);
    if (targetKey) expect(e.getVitals()[targetKey]).toBe(override);
    // The event is logged exactly once.
    const fires = e.snapshot().log.filter((l) => l.kind === 'event' && l.label === auto.label);
    expect(fires).toHaveLength(1);
  });

  it('an auto event fired while idle is not re-queued on start', () => {
    const e = newEngine();
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined);
    if (!auto) return;
    e.triggerEvent(auto.id); // fired during setup, before Start
    e.start();
    e.tick(auto.autoAtSec! + 30);
    const fires = e.snapshot().log.filter((l) => l.kind === 'event' && l.label === auto.label);
    expect(fires).toHaveLength(1);
  });

  it('fires autoAtSec events at the right time', () => {
    const e = newEngine();
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined);
    if (!auto) return; // scenario has no auto events
    e.start();
    e.tick(auto.autoAtSec! - 1);
    expect(e.snapshot().firedEventIds).not.toContain(auto.id);
    e.tick(2);
    expect(e.snapshot().firedEventIds).toContain(auto.id);
  });

  it('never fires autos when constructed with autoEvents: false', () => {
    const e = new SimulationEngine(scenario(), 'TEST', { autoEvents: false });
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined);
    if (!auto) return;
    e.start();
    e.tick(auto.autoAtSec! + 60);
    e.skipAhead(600);
    expect(e.snapshot().firedEventIds).not.toContain(auto.id);
    expect(e.snapshot().autoEventsEnabled).toBe(false);
    // Manual triggering still works with autos off.
    e.triggerEvent(auto.id);
    expect(e.snapshot().firedEventIds).toContain(auto.id);
  });

  it('setAutoEvents(false) mid-run cancels scheduled autos', () => {
    const e = newEngine();
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined && x.autoAtSec > 30);
    if (!auto) return;
    e.start();
    e.tick(10);
    e.setAutoEvents(false);
    e.tick(auto.autoAtSec! + 60);
    expect(e.snapshot().firedEventIds).not.toContain(auto.id);
    expect(e.snapshot().log.some((l) => l.label === 'Auto events off')).toBe(true);
  });

  it('setAutoEvents(true) mid-run schedules future autos but not past-due ones', () => {
    const autos = scenario()
      .events.filter((x) => x.autoAtSec !== undefined)
      .sort((a, b) => a.autoAtSec! - b.autoAtSec!);
    if (autos.length < 2) return;
    const [first, second] = autos;
    const e = new SimulationEngine(scenario(), 'TEST', { autoEvents: false });
    e.start();
    e.tick(first.autoAtSec! + 1); // first is now past due, still unfired
    e.setAutoEvents(true);
    e.tick(second.autoAtSec! - first.autoAtSec! + 60);
    expect(e.snapshot().firedEventIds).not.toContain(first.id); // no retro-fire
    expect(e.snapshot().firedEventIds).toContain(second.id);
  });

  it('records the elapsed time of each phase change', () => {
    const e = newEngine();
    if (e.scenario.phases.length < 2) return;
    expect(e.snapshot().phaseChangedAtSec).toBe(0);
    e.start();
    e.tick(90);
    e.setPhase(e.scenario.phases[1].id);
    expect(e.snapshot().phaseChangedAtSec).toBe(90);
    // Re-setting the same phase does not restart the timer.
    e.tick(30);
    e.setPhase(e.scenario.phases[1].id);
    expect(e.snapshot().phaseChangedAtSec).toBe(90);
    e.reset();
    expect(e.snapshot().phaseChangedAtSec).toBe(0);
  });

  it('does not cross-cancel events that share a label (id is the identity)', () => {
    // Labels are display-only and the schema does not force them unique.
    const s: Scenario = {
      ...scenario(),
      events: [
        {
          id: 'auto-dup',
          label: 'Same label',
          category: 'physiology',
          autoAtSec: 60,
          effects: [{ vitals: { hr: 150 } }],
        },
        { id: 'manual-dup', label: 'Same label', category: 'other', effects: [] },
      ],
    };
    const e = new SimulationEngine(s, 'TEST');
    e.start();
    e.tick(10);
    e.triggerEvent('manual-dup'); // must NOT cancel auto-dup's scheduled copy
    e.tick(60);
    expect(e.snapshot().firedEventIds).toContain('auto-dup');
    expect(e.getVitals().hr).toBe(150);
  });

  it('toggle-off keeps the staged effects of an auto event that already fired', () => {
    const s: Scenario = {
      ...scenario(),
      events: [
        {
          id: 'two-stage',
          label: 'Two-stage deterioration',
          category: 'physiology',
          autoAtSec: 30,
          effects: [{ vitals: { hr: 120 } }, { vitals: { hr: 150 }, afterSec: 60 }],
        },
      ],
    };
    const e = new SimulationEngine(s, 'TEST');
    e.start();
    e.tick(31); // stage 1 fires and is logged; stage 2 queued for t=90
    expect(e.snapshot().firedEventIds).toContain('two-stage');
    expect(e.getVitals().hr).toBe(120);
    e.setAutoEvents(false); // cancels unfired autos only — not a fired event's tail
    e.tick(60);
    expect(e.getVitals().hr).toBe(150);
  });

  it('keeps the autoEvents flag across reset()', () => {
    const e = new SimulationEngine(scenario(), 'TEST', { autoEvents: false });
    e.start();
    e.reset();
    expect(e.snapshot().autoEventsEnabled).toBe(false);
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined);
    if (!auto) return;
    e.start();
    e.tick(auto.autoAtSec! + 60);
    expect(e.snapshot().firedEventIds).not.toContain(auto.id);
  });

  it('marks actions and records the time', () => {
    const e = newEngine();
    e.start();
    e.tick(90);
    const action = e.scenario.expectedActions[0];
    e.markAction(action.id, 'done');
    const rec = e.snapshot().actions.find((a) => a.actionId === action.id)!;
    expect(rec.status).toBe('done');
    expect(rec.markedAtSec).toBe(90);
  });

  it('converts pending actions to missed on end', () => {
    const e = newEngine();
    e.start();
    e.end();
    expect(e.snapshot().actions.every((a) => a.status === 'missed')).toBe(true);
  });

  it('changes phase and logs it', () => {
    const e = newEngine();
    e.start();
    const second = e.scenario.phases[1];
    e.setPhase(second.id);
    const snap = e.snapshot();
    expect(snap.phaseId).toBe(second.id);
    expect(snap.log.some((l) => l.kind === 'phase')).toBe(true);
  });

  it('defaults the capnograph shape to normal and applies faculty changes', () => {
    const e = newEngine();
    expect(e.getVitals().capnoShape).toBe('normal');
    e.start();
    e.setCapnoShape('bronchospasm');
    const snap = e.snapshot();
    expect(snap.vitals.capnoShape).toBe('bronchospasm');
    expect(
      snap.log.some((l) => l.kind === 'vital_change' && l.label.includes('CO₂ waveform')),
    ).toBe(true);
    e.reset();
    expect(e.getVitals().capnoShape).toBe('normal');
  });

  it('applies capnoShape event effects', () => {
    const anaphylaxis = BUILT_IN_SCENARIOS.find((s) => s.id === 'anaphylaxis')!;
    const e = new SimulationEngine(anaphylaxis, 'TEST');
    e.start();
    e.triggerEvent('full-anaphylaxis');
    expect(e.getVitals().capnoShape).toBe('bronchospasm');
    e.triggerEvent('albuterol-response');
    expect(e.getVitals().capnoShape).toBe('normal');
  });

  it('reset returns to a clean baseline', () => {
    const e = newEngine();
    e.start();
    e.tick(60);
    e.setVital('hr', 150, 0);
    e.markAction(e.scenario.expectedActions[0].id, 'done');
    e.reset();
    expect(e.getStatus()).toBe('idle');
    expect(e.getElapsedSec()).toBe(0);
    expect(e.getVitals().hr).toBe(scenario().baselineVitals.hr);
    expect(e.snapshot().actions.every((a) => a.status === 'pending')).toBe(true);
    expect(e.snapshot().log).toHaveLength(0);
  });

  it('skipAhead advances time, fires due auto events, and works while paused', () => {
    const e = newEngine();
    const auto = e.scenario.events.find((x) => x.autoAtSec !== undefined);
    e.start();
    e.pause();
    e.skipAhead(300);
    expect(e.getElapsedSec()).toBe(300);
    if (auto && auto.autoAtSec! <= 300) {
      expect(e.snapshot().firedEventIds).toContain(auto.id);
    }
    expect(e.snapshot().log.some((l) => l.label.startsWith('Skipped ahead'))).toBe(true);
  });

  it('skipAhead does not overshoot vital ramps', () => {
    // Events stripped so the scenario's own auto events can't override the ramp.
    const e = new SimulationEngine({ ...scenario(), events: [] }, 'TEST');
    e.start();
    e.setVital('hr', 150, 60);
    e.skipAhead(600);
    expect(e.getVitals().hr).toBe(150);
  });

  it('skipAhead is a no-op when idle or ended', () => {
    const e = newEngine();
    e.skipAhead(60);
    expect(e.getElapsedSec()).toBe(0);
    e.start();
    e.end();
    e.skipAhead(60);
    expect(e.snapshot().log.some((l) => l.label.startsWith('Skipped ahead'))).toBe(false);
  });

  it('records vitals history every 10 seconds and on end', () => {
    const e = newEngine();
    e.start();
    for (let i = 0; i < 70; i++) e.tick(0.5); // 35 s
    e.end();
    const history = e.getHistory();
    // t=0, t≈10, t≈20, t≈30, final ≈35
    expect(history.length).toBe(5);
    expect(history[0].t).toBe(0);
    expect(history[history.length - 1].t).toBe(35);
    expect(JSON.parse(JSON.stringify(history))).toEqual(history);
  });

  it('history is excluded from snapshots', () => {
    const e = newEngine();
    e.start();
    e.tick(30);
    expect('history' in e.snapshot()).toBe(false);
  });

  it('produces a serializable snapshot', () => {
    const e = newEngine();
    e.start();
    e.tick(5);
    const snap = e.snapshot();
    const roundTripped = JSON.parse(JSON.stringify(snap));
    expect(roundTripped).toEqual(snap);
  });
});

describe('NIBP cycling', () => {
  it('seeds a baseline reading and refreshes on the cuff interval', () => {
    // No monitoring config → cuff mode at 180 s; events stripped so the
    // scenario's auto events can't change BP mid-test.
    const e = new SimulationEngine({ ...scenario(), events: [] }, 'TEST');
    expect(e.snapshot().nibp).toEqual({
      sbp: scenario().baselineVitals.sbp,
      dbp: scenario().baselineVitals.dbp,
      atSec: 0,
    });
    e.start();
    e.setVital('sbp', 80, 0);
    e.tick(60);
    expect(e.snapshot().nibp?.sbp).toBe(scenario().baselineVitals.sbp); // cuff not due yet
    e.tick(130); // past 180 s
    expect(e.snapshot().nibp?.sbp).toBe(80);
  });

  it('cycleNibp takes an on-demand reading and logs it', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 85, 0);
    e.setVital('dbp', 45, 0);
    e.tick(10);
    e.cycleNibp();
    const snap = e.snapshot();
    expect(snap.nibp).toEqual({ sbp: 85, dbp: 45, atSec: 10 });
    expect(snap.log.some((l) => l.label === 'NIBP 85/45')).toBe(true);
  });

  it('BP alarms judge the last measured reading, not the live value', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 60, 0); // critically low, but the cuff has not cycled
    e.tick(1);
    expect(e.snapshot().alarms.some((a) => a.vital === 'sbp')).toBe(false);
    e.cycleNibp();
    expect(e.snapshot().alarms.some((a) => a.vital === 'sbp' && a.level === 'critical')).toBe(true);
  });

  it('artLine mode keeps continuous BP (nibp null, live alarms)', () => {
    const artScenario = { ...scenario(), monitoring: { artLine: true } };
    const e = new SimulationEngine(artScenario, 'TEST');
    e.start();
    e.setVital('sbp', 60, 0);
    e.tick(1);
    const snap = e.snapshot();
    expect(snap.nibp).toBeNull();
    expect(snap.alarms.some((a) => a.vital === 'sbp' && a.level === 'critical')).toBe(true);
  });

  it('faculty can place and remove an arterial line at runtime', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 60, 0); // true pressure drops, cuff has not re-cycled
    e.tick(1);
    expect(e.snapshot().nibp).not.toBeNull();

    e.setArtLine(true);
    const live = e.snapshot();
    expect(live.nibp).toBeNull(); // continuous BP now
    expect(live.alarms.some((a) => a.vital === 'sbp' && a.level === 'critical')).toBe(true);

    e.setArtLine(false);
    const back = e.snapshot();
    expect(back.nibp).not.toBeNull(); // immediate cuff reading on removal
    expect(back.nibp?.sbp).toBe(60);
  });
});
