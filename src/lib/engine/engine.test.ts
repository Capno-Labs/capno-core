import { describe, expect, it } from 'vitest';
import { generateSessionId, isValidSessionCode, SimulationEngine } from './engine';
import { parseScenario } from './schema';
import { clampVital } from './vitals';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { NumericVitals, Scenario, ScenarioEvent } from './types';

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

  describe('rhythm-implied heart rate', () => {
    it('sinus brady ramps HR below 60 when it is 60 or above', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 80, 0);
      e.setRhythm('sinus_brady');
      e.tick(10); // past the 5 s ramp
      expect(e.getVitals().hr).toBe(50);
    });

    it('sinus tach ramps HR above 100 when it is 100 or below', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 80, 0);
      e.setRhythm('sinus_tach');
      e.tick(10);
      expect(e.getVitals().hr).toBe(110);
    });

    it('leaves an already-in-range HR untouched', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 45, 0);
      e.setRhythm('sinus_brady');
      e.tick(10);
      expect(e.getVitals().hr).toBe(45);
    });

    it('adjusts once on selection — the instructor can re-dial HR afterwards', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 80, 0);
      e.setRhythm('sinus_brady');
      e.tick(10);
      e.setVital('hr', 80, 0);
      expect(e.getVitals().hr).toBe(80);
    });
  });

  describe('measured etCO2 at apnea', () => {
    it('reads 0 at apnea (RR = 0) but keeps the set value underneath', () => {
      const e = newEngine();
      e.start();
      e.setVital('etco2', 40, 0);
      e.setVital('rr', 0, 0);
      // The capnograph is flat, so the numeric tile must read 0 too.
      expect(e.snapshot().vitals.etco2).toBe(0);
      // The transform is display-only: the set value is untouched and
      // restores the instant the rate returns.
      expect(e.getVitals().etco2).toBe(40);
      e.setVital('rr', scenario().baselineVitals.rr, 0);
      expect(e.snapshot().vitals.etco2).toBe(40);
    });

    it('leaves etCO2 faculty-driven at any non-zero rate (no RR coupling)', () => {
      const e = newEngine();
      e.start();
      e.setVital('etco2', 40, 0);
      // A low (but non-apneic) rate must not move the number: scenarios author
      // etCO2 to represent gas exchange directly (e.g. low CO2 during airway
      // obstruction), so RR alone does not drive it.
      e.setVital('rr', 4, 0);
      expect(e.snapshot().vitals.etco2).toBe(40);
      e.setVital('rr', 30, 0);
      expect(e.snapshot().vitals.etco2).toBe(40);
    });

    it('fires the critical low-EtCO₂ alarm at apnea', () => {
      const e = newEngine();
      e.start();
      e.setVital('etco2', 40, 0);
      e.setVital('rr', 0, 0);
      const alarms = e.snapshot().alarms;
      expect(alarms.some((a) => a.vital === 'etco2' && a.level === 'critical')).toBe(true);
    });
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

  it('caps the snapshot log at a tail while getFullLog keeps everything', () => {
    const e = newEngine();
    e.start();
    // Alternate shapes so each call logs (a repeated value is a no-op).
    for (let i = 0; i < 120; i++) {
      e.setCapnoShape(i % 2 === 0 ? 'bronchospasm' : 'normal');
    }
    const full = e.getFullLog();
    expect(full.length).toBeGreaterThan(100);
    const snap = e.snapshot();
    expect(snap.log).toHaveLength(100);
    // The tail is the newest entries, ending where the full log ends.
    expect(snap.log[snap.log.length - 1]).toEqual(full[full.length - 1]);
    expect(snap.log[0]).toEqual(full[full.length - 100]);
  });

  it('validates session codes against the generator format', () => {
    expect(isValidSessionCode(generateSessionId())).toBe(true);
    expect(isValidSessionCode('ROOM42')).toBe(false); // 6 chars — the join input caps at 4
    expect(isValidSessionCode('KX3O')).toBe(false); // O is not in the confusable-free alphabet
    expect(isValidSessionCode('')).toBe(false);
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

describe('live-added events and the next-up pin', () => {
  const adhoc = {
    id: 'adhoc-1',
    label: 'Improvised bleeding',
    category: 'circulation' as const,
    effects: [{ vitals: { sbp: 80 }, overSec: 0 }],
  };

  it('addEvent appends to the working list without mutating the scenario', () => {
    const e = newEngine();
    const authoredCount = e.scenario.events.length;
    expect(e.addEvent(adhoc)).toBe(true);
    expect(e.getEvents()).toHaveLength(authoredCount + 1);
    expect(e.getEvents().at(-1)?.id).toBe('adhoc-1');
    // The source scenario is untouched — the core persistence guarantee.
    expect(e.scenario.events).toHaveLength(authoredCount);
    expect(e.scenario.events.some((ev) => ev.id === 'adhoc-1')).toBe(false);
    expect(e.snapshot().log.some((l) => l.kind === 'session' && l.label.includes(adhoc.label))).toBe(
      true,
    );
  });

  it('addEvent strips autoAtSec and actionIds at runtime', () => {
    const e = newEngine();
    // The store action's Omit type doesn't bind non-literal callers, so the
    // engine must enforce the fire-when-ready contract itself.
    const smuggled = { ...adhoc, autoAtSec: 5, actionIds: ['nope'] } as ScenarioEvent;
    expect(e.addEvent(smuggled)).toBe(true);
    const added = e.getEvents().find((ev) => ev.id === adhoc.id)!;
    expect(added.autoAtSec).toBeUndefined();
    expect(added.actionIds).toBeUndefined();
    e.start();
    e.tick(60);
    expect(e.snapshot().firedEventIds).not.toContain(adhoc.id);
  });

  it('addEvent rejects a duplicate id', () => {
    const e = newEngine();
    expect(e.addEvent(adhoc)).toBe(true);
    expect(e.addEvent({ ...adhoc, label: 'Different label' })).toBe(false);
    expect(e.getEvents().filter((ev) => ev.id === 'adhoc-1')).toHaveLength(1);
    expect(e.addEvent({ ...adhoc, id: e.scenario.events[0].id })).toBe(false);
  });

  it('an added event fires like any authored event', () => {
    const e = newEngine();
    e.addEvent(adhoc);
    e.start();
    expect(e.triggerEvent('adhoc-1')?.label).toBe(adhoc.label);
    expect(e.getVitals().sbp).toBe(80);
    const snap = e.snapshot();
    expect(snap.firedEventIds).toContain('adhoc-1');
    expect(snap.log.some((l) => l.kind === 'event' && l.label === adhoc.label)).toBe(true);
  });

  it('added events never auto-fire', () => {
    const e = newEngine(); // autoEvents defaults to true in the engine
    e.addEvent(adhoc);
    e.start();
    e.tick(600);
    e.skipAhead(3600);
    expect(e.snapshot().firedEventIds).not.toContain('adhoc-1');
  });

  it('pinNextEvent round-trips, ignores unknown ids, and clears on reset', () => {
    const e = newEngine();
    const target = e.scenario.events[1].id;
    expect(e.getPinnedNextEventId()).toBeNull();
    e.pinNextEvent(target);
    expect(e.getPinnedNextEventId()).toBe(target);
    e.pinNextEvent('no-such-event');
    expect(e.getPinnedNextEventId()).toBe(target);
    e.pinNextEvent(null);
    expect(e.getPinnedNextEventId()).toBeNull();
    e.pinNextEvent(target);
    e.reset();
    expect(e.getPinnedNextEventId()).toBeNull();
  });

  it('reset keeps added events but clears their fired state', () => {
    const e = newEngine();
    e.addEvent(adhoc);
    e.start();
    e.triggerEvent('adhoc-1');
    e.reset();
    expect(e.getEvents().some((ev) => ev.id === 'adhoc-1')).toBe(true);
    expect(e.snapshot().firedEventIds).not.toContain('adhoc-1');
  });

  it('getEffectiveScenario includes added events and stays schema-valid', () => {
    const e = newEngine();
    e.addEvent(adhoc);
    const effective = e.getEffectiveScenario();
    expect(effective.events.some((ev) => ev.id === 'adhoc-1')).toBe(true);
    // The archive/export/import boundary re-validates with the full schema.
    expect(() => parseScenario(JSON.parse(JSON.stringify(effective)))).not.toThrow();
    // Still a shallow overlay: the authored scenario object is unchanged.
    expect(e.scenario.events.some((ev) => ev.id === 'adhoc-1')).toBe(false);
  });
});

describe('pulse pressure stays at least 20 mmHg', () => {
  it('caps a dbp target at systolic − 20', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 110, 0);
    e.setVital('dbp', 150, 0);
    expect(e.getVitals().dbp).toBe(90);
  });

  it('lowering sbp drags dbp down to preserve the gap', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 120, 0);
    e.setVital('dbp', 80, 0);
    e.setVital('sbp', 60, 0);
    const v = e.getVitals();
    expect(v.sbp).toBe(60);
    expect(v.dbp).toBe(40);
  });

  it('never lets dbp close within 20 of sbp mid-ramp, then dbp settles at the capped target', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 100, 0);
    e.setVital('dbp', 60, 0);
    // sbp climbs slowly to 140 while dbp races toward 130: unpinned, dbp
    // would overtake sbp on the way up. The dbp target itself is capped at
    // sbp target − 20 = 120.
    e.setVital('sbp', 140, 100);
    e.setVital('dbp', 130, 1);
    for (let i = 0; i < 120; i++) {
      e.tick(1);
      const v = e.getVitals();
      expect(v.dbp).toBeLessThanOrEqual(v.sbp - 20);
    }
    // Once sbp finishes climbing, dbp resumes and lands on the capped target.
    expect(e.getVitals().sbp).toBe(140);
    expect(e.getVitals().dbp).toBe(120);
  });

  it('caps an event effect that narrows the pulse pressure', () => {
    const e = newEngine();
    e.addEvent({
      id: 'bad-bp',
      label: 'Effect with impossible BP',
      category: 'circulation',
      effects: [{ vitals: { sbp: 90, dbp: 120 }, overSec: 0 }],
    });
    e.start();
    e.triggerEvent('bad-bp');
    expect(e.getVitals().sbp).toBe(90);
    expect(e.getVitals().dbp).toBe(70);
  });

  it('normalizes a malformed authored baseline at construction', () => {
    const bad = {
      ...scenario(),
      baselineVitals: { ...scenario().baselineVitals, sbp: 100, dbp: 130 },
    };
    const e = new SimulationEngine(bad, 'TEST');
    expect(e.getVitals().dbp).toBe(80);
    expect(e.snapshot().nibp?.dbp).toBe(80); // seeds the first cuff reading too
  });

  it('allows 0/0 arrest states — the dbp floor is 0, not negative', () => {
    const e = newEngine();
    e.start();
    e.setVital('sbp', 0, 0);
    const v = e.getVitals();
    expect(v.sbp).toBe(0);
    expect(v.dbp).toBe(0);
  });
});

describe('inspired agent follows the end-tidal target', () => {
  it('setting an Et Sev target puts Fi Sev there immediately while Et ramps (wash-in)', () => {
    const e = newEngine();
    e.start();
    e.setVital('agentEt', 0, 0);
    e.setVital('agentEt', 2.0, 30);
    expect(e.getVitals().agentFi).toBe(2.0);
    expect(e.getVitals().agentEt).toBeLessThan(2.0);
    e.tick(30);
    expect(e.getVitals().agentEt).toBe(2.0);
  });

  it('lowering the Et Sev target puts Fi Sev below the falling Et (wash-out)', () => {
    const e = newEngine();
    e.start();
    e.setVital('agentEt', 2.0, 0);
    e.setVital('agentEt', 0.5, 30);
    const v = e.getVitals();
    expect(v.agentFi).toBe(0.5);
    expect(v.agentEt).toBeGreaterThan(v.agentFi);
  });

  it('an event effect that sets only agentEt couples Fi; an authored agentFi wins', () => {
    const e = newEngine();
    e.addEvent({
      id: 'et-only',
      label: 'Vaporizer up',
      category: 'physiology',
      effects: [{ vitals: { agentEt: 1.8 }, overSec: 0 }],
    });
    e.addEvent({
      id: 'both-authored',
      label: 'Authored gas pair',
      category: 'physiology',
      effects: [{ vitals: { agentEt: 1.2, agentFi: 2.5 }, overSec: 0 }],
    });
    e.start();
    e.triggerEvent('et-only');
    expect(e.getVitals().agentFi).toBe(1.8);
    e.triggerEvent('both-authored');
    expect(e.getVitals().agentFi).toBe(2.5);
  });
});

describe('SimulationEngine.applyNamedEffect', () => {
  it('writes a single log entry and ramps toward the target', () => {
    const e = newEngine();
    e.start();
    const logBefore = e.snapshot().log.length;
    const startSpo2 = e.getVitals().spo2;
    e.applyNamedEffect('Ad-hoc: Desaturation', { vitals: { spo2: startSpo2 - 20 }, overSec: 20 });
    expect(e.snapshot().log.length).toBe(logBefore + 1);
    const entry = e.snapshot().log.at(-1)!;
    expect(entry.kind).toBe('vital_change');
    expect(entry.label).toBe('Ad-hoc: Desaturation');
    expect(entry.detail).toBe('over 20s');
    e.tick(10);
    expect(e.getVitals().spo2).toBeCloseTo(startSpo2 - 10, 0);
    e.tick(20);
    expect(e.getVitals().spo2).toBe(startSpo2 - 20);
  });

  it('applies instantly when overSec is absent and honors afterSec delays', () => {
    const e = newEngine();
    e.start();
    e.applyNamedEffect('instant', { vitals: { hr: 55 } });
    expect(e.getVitals().hr).toBe(55);
    e.applyNamedEffect('delayed', { vitals: { hr: 130 }, afterSec: 30 });
    expect(e.getVitals().hr).toBe(55); // not yet
    e.tick(31);
    expect(e.getVitals().hr).toBe(130);
  });

  it('works while idle (pre-start adjustments), like setVital', () => {
    const e = newEngine();
    e.applyNamedEffect('pre-start', { vitals: { spo2: 91 } });
    expect(e.getVitals().spo2).toBe(91);
  });
});
