import { describe, expect, it } from 'vitest';
import { generateSessionId, isValidSessionCode, SimulationEngine } from './engine';
import { parseScenario } from './schema';
import {
  ageAdjustedMac,
  ALARM_LIMIT_STEP,
  ALARM_PROFILES,
  alarmLimitProblems,
  blockDepth,
  clampVital,
  defaultVentilation,
  MAC_AT_40,
  predictedBodyWeightKg,
  TOF_INTERVAL_SEC,
} from './vitals';
import { PTC_MAX } from './types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { NumericVitals, Scenario, ScenarioEvent, Ventilation } from './types';

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

    it('an effect authoring both rhythm and HR keeps the authored rate (no implied log)', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 80, 0);
      e.addEvent({
        id: 'adhoc-tach',
        label: 'Tachycardia onset',
        category: 'circulation',
        effects: [{ rhythm: 'sinus_tach', vitals: { hr: 104 }, overSec: 0 }],
      });
      e.triggerEvent('adhoc-tach');
      e.tick(10);
      expect(e.getVitals().hr).toBe(104);
      expect(e.snapshot().log.some((l) => l.label === 'HR → 110 bpm')).toBe(false);
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

  describe('anesthesia machine: ventilator readings, agent and MAC', () => {
    const withVent = (vent: Scenario['baselineVitals']['vent'] = {}): Scenario => ({
      ...scenario(),
      baselineVitals: { ...scenario().baselineVitals, vent },
    });

    it('shows no machine readings unless the scenario or the instructor asks', () => {
      const e = newEngine();
      expect(e.getVentShown()).toBe(false);
      expect('vent' in e.getVitals()).toBe(false);
      e.start();
      e.setVentShown(true);
      expect(e.getVitals().vent).toBeDefined();
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'Machine readings shown' });
      e.setVentShown(false);
      expect('vent' in e.getVitals()).toBe(false);
    });

    it('starts from defaults sized to the patient when the scenario states none', () => {
      const s = withVent({});
      const e = new SimulationEngine(s, 'TEST');
      const vent = e.getVitals().vent as Ventilation;
      expect(vent).toEqual(defaultVentilation(s.patient));
      // Tidal volume follows predicted body weight, not actual weight: 6–8 mL/kg.
      expect(vent.vt).toBe(Math.round((7 * predictedBodyWeightKg(s.patient)) / 10) * 10);
      const perKg = vent.vt / predictedBodyWeightKg(s.patient);
      expect(perKg).toBeGreaterThanOrEqual(6);
      expect(perKg).toBeLessThanOrEqual(8);
      // Pressures inside the interquartile ranges of a large surgical cohort.
      expect(vent.pip).toBeGreaterThanOrEqual(15);
      expect(vent.pip).toBeLessThanOrEqual(21);
      expect(vent.pplat).toBeGreaterThanOrEqual(13);
      expect(vent.pplat).toBeLessThanOrEqual(18.5);
      expect(vent.pplat - vent.peep).toBeLessThan(15); // driving pressure
      expect(vent.peep).toBe(5);
      expect(vent.pip).toBeGreaterThan(vent.pplat);
    });

    it('lays the scenario\'s stated readings over the defaults', () => {
      const e = new SimulationEngine(withVent({ pip: 34, fio2: 100 }), 'TEST');
      const vent = e.getVitals().vent!;
      expect(vent.pip).toBe(34);
      expect(vent.fio2).toBe(100);
      expect(vent.peep).toBe(defaultVentilation(scenario().patient).peep);
    });

    it('ramps each reading like a numeric vital, changing only what is asked', () => {
      const e = new SimulationEngine(withVent({ pip: 20, pplat: 16 }), 'TEST');
      e.start();
      e.setVent({ pip: 44 }, 60);
      expect(e.getVentTarget('pip')).toBe(44);
      e.tick(30);
      expect(e.getVitals().vent).toMatchObject({ pip: 32, pplat: 16 });
      e.tick(30);
      expect(e.getVitals().vent).toMatchObject({ pip: 44, pplat: 16 });
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'PIP → 44 cmH₂O', detail: 'over 60s' });
    });

    it('clamps readings to their ranges', () => {
      const e = new SimulationEngine(withVent(), 'TEST');
      e.start();
      e.setVent({ fio2: -5, pip: 500, vt: -20 });
      expect(e.getVitals().vent).toMatchObject({ fio2: 0, pip: 80, vt: 0 });
      e.setVent({ fio2: 140 });
      expect(e.getVitals().vent?.fio2).toBe(100);
    });

    it('never shows a plateau above the peak, or PEEP above the plateau', () => {
      const e = new SimulationEngine(withVent({ pip: 20, pplat: 16, peep: 5 }), 'TEST');
      e.start();
      e.setVent({ pip: 0, vt: 0 }); // disconnection: pressure and volume are lost
      expect(e.getVitals().vent).toMatchObject({ pip: 0, pplat: 0, peep: 0, vt: 0 });
      e.setVent({ pip: 20 }); // reconnected: the plateau and PEEP it had come back
      expect(e.getVitals().vent).toMatchObject({ pip: 20, pplat: 16, peep: 5 });
    });

    it('is driven by authored effects and returns to baseline on reset', () => {
      const e = new SimulationEngine(withVent({ pip: 18 }), 'TEST');
      e.start();
      e.applyNamedEffect('Bronchospasm', { vent: { pip: 42 }, overSec: 20 });
      e.tick(10);
      expect(e.getVitals().vent?.pip).toBe(30);
      e.setVentShown(false);
      e.reset();
      expect(e.getVitals().vent?.pip).toBe(18);
      expect(e.getVentShown()).toBe(true);
    });

    describe('machine alarms (Dräger factory defaults)', () => {
      const machine = () => {
        const e = new SimulationEngine(withVent(), 'TEST');
        e.start();
        return e;
      };
      const machineAlarms = (e: SimulationEngine) =>
        e.snapshot().alarms.filter((a) => a.vital === 'paw' || a.vital === 'vt' || a.vital === 'fio2');

      it('is quiet on the default readings', () => {
        expect(machineAlarms(machine())).toEqual([]);
      });

      it('alarms on airway pressure above 40 cmH2O', () => {
        const e = machine();
        e.setVent({ pip: 40 });
        expect(machineAlarms(e)).toEqual([]);
        e.setVent({ pip: 45 });
        expect(machineAlarms(e)).toEqual([{ vital: 'paw', level: 'critical', message: 'Paw HIGH 45' }]);
      });

      it('alarms when no pressure is being generated — a disconnection', () => {
        const e = machine();
        e.setVent({ pip: 3, vt: 0 });
        expect(machineAlarms(e)).toEqual([
          { vital: 'paw', level: 'critical', message: 'APNEA PRESSURE' },
          { vital: 'vt', level: 'warning', message: 'MV low 0.0' },
        ]);
      });

      it('alarms on minute volume under 3 or over 12 L/min, from tidal volume and rate', () => {
        const e = machine();
        e.setVital('rr', 12);
        e.setVent({ vt: 240 }); // 2.9 L/min
        expect(machineAlarms(e)).toEqual([{ vital: 'vt', level: 'warning', message: 'MV low 2.9' }]);
        e.setVent({ vt: 500 }); // 6.0 L/min
        expect(machineAlarms(e)).toEqual([]);
        e.setVital('rr', 26); // 13.0 L/min
        expect(machineAlarms(e)).toEqual([{ vital: 'vt', level: 'warning', message: 'MV high 13.0' }]);
      });

      it('alarms on inspired oxygen under 20% — a failed or crossed supply', () => {
        const e = machine();
        e.setVent({ fio2: 21 });
        expect(machineAlarms(e)).toEqual([]);
        e.setVent({ fio2: 12 });
        expect(machineAlarms(e)).toEqual([{ vital: 'fio2', level: 'critical', message: 'FiO₂ LOW 12' }]);
      });

      it('raises none of them while the machine readings are hidden', () => {
        const e = machine();
        e.setVent({ pip: 60, fio2: 10 });
        expect(machineAlarms(e).length).toBe(2);
        e.setVentShown(false);
        expect(machineAlarms(e)).toEqual([]);
      });
    });

    it('defaults to sevoflurane and switches agent on request or by effect', () => {
      const e = newEngine();
      expect(e.getVitals().agent).toBe('sevoflurane');
      expect(e.snapshot().gas?.agent).toBe('sevoflurane');
      e.start();
      e.setAgent('desflurane');
      expect(e.snapshot().gas?.agent).toBe('desflurane');
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'Agent → Desflurane' });
      e.applyNamedEffect('Switch', { agent: 'isoflurane' });
      expect(e.getVitals().agent).toBe('isoflurane');
      e.reset();
      expect(e.getVitals().agent).toBe('sevoflurane');
    });

    it('reports end-tidal agent as a multiple of the patient\'s age-adjusted MAC', () => {
      const age = (years: number): Scenario => ({ ...scenario(), patient: { ...scenario().patient, age: years } });
      const macAt = (years: number, agent: 'sevoflurane' | 'isoflurane' | 'desflurane', et: number) => {
        const e = new SimulationEngine(age(years), 'TEST');
        e.start();
        e.setAgent(agent);
        e.setVital('agentEt', et);
        return e.snapshot().gas!.mac;
      };
      // One MAC at 40 for each agent's MAC value…
      expect(macAt(40, 'sevoflurane', MAC_AT_40.sevoflurane)).toBeCloseTo(1, 2);
      expect(macAt(40, 'isoflurane', MAC_AT_40.isoflurane)).toBeCloseTo(1, 1);
      expect(macAt(40, 'desflurane', MAC_AT_40.desflurane)).toBeCloseTo(1, 2);
      // …the same concentration is more MAC in an older patient, less in a younger one…
      expect(macAt(80, 'sevoflurane', 1.8)).toBeGreaterThan(macAt(40, 'sevoflurane', 1.8));
      expect(macAt(20, 'sevoflurane', 1.8)).toBeLessThan(macAt(40, 'sevoflurane', 1.8));
      // …and nothing is nothing.
      expect(macAt(40, 'sevoflurane', 0)).toBe(0);
    });

    it('computes predicted body weight by the ARDS Network formula', () => {
      expect(predictedBodyWeightKg({ sex: 'male', heightCm: 152.4 })).toBeCloseTo(50, 6);
      expect(predictedBodyWeightKg({ sex: 'female', heightCm: 152.4 })).toBeCloseTo(45.5, 6);
      expect(predictedBodyWeightKg({ sex: 'male', heightCm: 180 })).toBeCloseTo(50 + 0.91 * 27.6, 6);
      expect(predictedBodyWeightKg({ sex: 'female', heightCm: 165 })).toBeCloseTo(45.5 + 0.91 * 12.6, 6);
    });

    it('lowers MAC by about 6% per decade of age', () => {
      expect(ageAdjustedMac('sevoflurane', 40)).toBeCloseTo(1.8, 6);
      expect(ageAdjustedMac('isoflurane', 40)).toBeCloseTo(1.17, 6);
      expect(ageAdjustedMac('desflurane', 40)).toBeCloseTo(6.6, 6);
      const perDecade = ageAdjustedMac('sevoflurane', 50) / ageAdjustedMac('sevoflurane', 40);
      expect(perDecade).toBeGreaterThan(0.93);
      expect(perDecade).toBeLessThan(0.95);
    });

    it('keeps the snapshot serializable with machine readings on', () => {
      const e = new SimulationEngine(withVent({ pip: 22 }), 'TEST');
      e.start();
      e.setVent({ vt: 380 }, 10);
      e.tick(3);
      const snap = e.snapshot();
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
  });

  describe('alarm limits: patient category and per-case changes', () => {
    const withMonitoring = (monitoring: Scenario['monitoring']): Scenario => ({ ...scenario(), monitoring });
    const running = (monitoring?: Scenario['monitoring']) => {
      const e = new SimulationEngine(withMonitoring(monitoring), 'TEST');
      e.start();
      return e;
    };
    const alarmOn = (e: SimulationEngine, vital: string) => e.snapshot().alarms.find((a) => a.vital === vital);

    it('uses the adult limits unless the scenario says otherwise, and reports them', () => {
      const snap = running().snapshot();
      expect(snap.alarmProfile).toBe('adult');
      expect(snap.alarmLimits).toEqual(ALARM_PROFILES.adult);
    });

    it('keeps the adult set as it has always been', () => {
      expect(ALARM_PROFILES.adult).toEqual({
        hr: { warnLow: 50, warnHigh: 110, critLow: 40, critHigh: 140 },
        sbp: { warnLow: 90, warnHigh: 160, critLow: 70, critHigh: 200 },
        spo2: { warnLow: 92, critLow: 85 },
        etco2: { warnLow: 25, warnHigh: 50, critLow: 15, critHigh: 60 },
        rr: { warnLow: 8, warnHigh: 24, critLow: 4, critHigh: 35 },
        temp: { warnLow: 35.0, warnHigh: 38.0, critHigh: 39.5 },
      });
    });

    it('takes pediatric and neonatal limits from the monitor\'s factory defaults', () => {
      // Philips IntelliVue MX750/MX850 IFU, default settings by patient category.
      const { pediatric, neonatal } = ALARM_PROFILES;
      expect([pediatric.hr.warnLow, pediatric.hr.warnHigh]).toEqual([75, 160]);
      expect([neonatal.hr.warnLow, neonatal.hr.warnHigh]).toEqual([100, 200]);
      // Extreme bradycardia and tachycardia: 20 bpm beyond each limit.
      expect([pediatric.hr.critLow, pediatric.hr.critHigh]).toEqual([55, 180]);
      expect([neonatal.hr.critLow, neonatal.hr.critHigh]).toEqual([80, 220]);
      expect([pediatric.sbp.warnLow, pediatric.sbp.warnHigh]).toEqual([70, 120]);
      expect([neonatal.sbp.warnLow, neonatal.sbp.warnHigh]).toEqual([40, 90]);
      expect([pediatric.rr.warnLow, pediatric.rr.warnHigh]).toEqual([8, 30]);
      expect([neonatal.rr.warnLow, neonatal.rr.warnHigh]).toEqual([30, 100]);
      expect([neonatal.spo2.warnLow, neonatal.spo2.critLow]).toEqual([85, 80]);
      // The same on every category on that monitor: left as the adult set.
      for (const profile of [pediatric, neonatal]) {
        expect(profile.etco2).toEqual(ALARM_PROFILES.adult.etco2);
        expect(profile.temp).toEqual(ALARM_PROFILES.adult.temp);
      }
    });

    it('has no profile whose limits contradict each other', () => {
      for (const profile of Object.values(ALARM_PROFILES)) {
        expect(alarmLimitProblems(profile)).toEqual([]);
      }
    });

    it('does not alarm on a child\'s normal vitals under the pediatric profile', () => {
      const adult = running();
      adult.setVital('hr', 130);
      adult.setVital('sbp', 85);
      adult.cycleNibp();
      expect(alarmOn(adult, 'hr')).toMatchObject({ level: 'warning' });
      expect(alarmOn(adult, 'sbp')).toMatchObject({ level: 'warning' });

      const child = running({ alarmProfile: 'pediatric' });
      child.setVital('hr', 130);
      child.setVital('sbp', 85);
      child.cycleNibp();
      expect(child.snapshot().alarms).toEqual([]);
      child.setVital('hr', 70);
      expect(alarmOn(child, 'hr')).toEqual({ vital: 'hr', level: 'warning', message: 'HR low 70' });
      child.setVital('hr', 50);
      expect(alarmOn(child, 'hr')).toEqual({ vital: 'hr', level: 'critical', message: 'HR LOW 50' });
    });

    it('lays a scenario\'s own limits over its profile, and null switches one off', () => {
      const e = running({ alarmLimits: { hr: { warnHigh: 125 }, temp: { warnLow: null } } });
      const limits = e.snapshot().alarmLimits!;
      expect(limits.hr).toEqual({ warnLow: 50, warnHigh: 125, critLow: 40, critHigh: 140 });
      expect(limits.temp).toEqual({ warnHigh: 38.0, critHigh: 39.5 });
      expect(limits.sbp).toEqual(ALARM_PROFILES.adult.sbp);
      e.setVital('hr', 120);
      e.setVital('temp', 34);
      expect(e.snapshot().alarms).toEqual([]);
      e.setVital('hr', 126);
      expect(alarmOn(e, 'hr')).toMatchObject({ level: 'warning' });
    });

    it('lets faculty switch category during a session and brings the scenario\'s changes back with its own', () => {
      const e = running({ alarmProfile: 'pediatric', alarmLimits: { hr: { warnHigh: 170 } } });
      expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(170);
      e.setAlarmProfile('neonatal');
      expect(e.getAlarmProfile()).toBe('neonatal');
      expect(e.snapshot().alarmLimits).toEqual(ALARM_PROFILES.neonatal);
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'Alarm limits → Neonatal' });
      e.setAlarmProfile('pediatric');
      expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(170);
      e.setAlarmProfile('adult');
      e.reset();
      expect(e.snapshot().alarmProfile).toBe('pediatric');
      expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(170);
    });

    describe('set on the monitor during a session', () => {
      it('sets the low and the high limit of one vital and leaves the rest alone', () => {
        const e = running();
        e.setAlarmLimit('hr', 'high', 125);
        e.setAlarmLimit('hr', 'low', 45);
        const limits = e.snapshot().alarmLimits!;
        expect(limits.hr).toEqual({ warnLow: 45, warnHigh: 125, critLow: 40, critHigh: 140 });
        expect(limits.sbp).toEqual(ALARM_PROFILES.adult.sbp);
        e.setVital('hr', 120);
        expect(e.snapshot().alarms).toEqual([]);
        e.setVital('hr', 126);
        expect(alarmOn(e, 'hr')).toEqual({ vital: 'hr', level: 'warning', message: 'HR high 126' });
        expect(e.getFullLog().map((l) => l.label)).toEqual(
          expect.arrayContaining(['HR high alarm limit → 125', 'HR low alarm limit → 45']),
        );
        // The shared profile object is never edited in place.
        expect(ALARM_PROFILES.adult.hr.warnHigh).toBe(110);
      });

      it('logs a run of presses on one limit as one adjustment', () => {
        const e = running();
        const limitLog = () => e.getFullLog().map((l) => l.label).filter((l) => l.includes('alarm limit'));
        e.setAlarmLimit('hr', 'high', 115);
        e.tick(1);
        e.setAlarmLimit('hr', 'high', 120);
        e.setAlarmLimit('hr', 'high', 125);
        expect(limitLog()).toEqual(['HR high alarm limit → 125']);
        // Another limit, or the same one much later, is a new line.
        e.setAlarmLimit('hr', 'low', 45);
        e.tick(30);
        e.setAlarmLimit('hr', 'low', 40);
        expect(limitLog()).toEqual(['HR high alarm limit → 125', 'HR low alarm limit → 45', 'HR low alarm limit → 40']);
      });

      it('steps a limit one press at a time, and a press inward switches an off limit on', () => {
        const e = running();
        e.stepAlarmLimit('hr', 'high', 1);
        expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(110 + ALARM_LIMIT_STEP.hr);
        e.stepAlarmLimit('hr', 'high', -1);
        expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(110);
        // SpO2 has no high limit: it sits at 100, so one press down turns it on.
        expect(e.snapshot().alarmLimits!.spo2.warnHigh).toBeUndefined();
        e.stepAlarmLimit('spo2', 'high', -1);
        expect(e.snapshot().alarmLimits!.spo2.warnHigh).toBe(99);
        e.stepAlarmLimit('spo2', 'high', 1);
        expect(e.snapshot().alarmLimits!.spo2.warnHigh).toBeUndefined();
      });

      it('lets learners operate the alarm setup by default, and keeps the instructor\'s choice across reset', () => {
        const e = running();
        expect(e.snapshot().learnerAlarmSetup).toBe(true);
        e.setLearnerAlarmSetup(false);
        expect(e.snapshot().log.at(-1)).toMatchObject({ kind: 'session', label: 'Learner alarm setup off' });
        e.reset();
        expect(e.snapshot().learnerAlarmSetup).toBe(false);
        expect(new SimulationEngine(scenario(), 'T', { learnerAlarmSetup: false }).getLearnerAlarmSetup()).toBe(false);
      });

      it('does not merge a learner\'s presses into the instructor\'s log line', () => {
        const e = running();
        e.stepAlarmLimit('hr', 'high', 1);
        e.stepAlarmLimit('hr', 'high', 1, 'display');
        e.stepAlarmLimit('hr', 'high', 1, 'display');
        const lines = e.getFullLog().filter((l) => l.label.includes('alarm limit'));
        expect(lines.map((l) => [l.label, l.detail])).toEqual([
          ['HR high alarm limit → 115', undefined],
          ['HR high alarm limit → 125', 'on a student display'],
        ]);
      });

      it('moves the critical limit only when the limit passes it', () => {
        const e = running();
        e.setAlarmLimit('hr', 'high', 150); // past the critical 140
        expect(e.snapshot().alarmLimits!.hr).toMatchObject({ warnHigh: 150, critHigh: 150 });
        e.setAlarmLimit('hr', 'low', 35); // past the critical 40
        expect(e.snapshot().alarmLimits!.hr).toMatchObject({ warnLow: 35, critLow: 35 });
        e.setAlarmLimit('sbp', 'low', 80); // not past 70
        expect(e.snapshot().alarmLimits!.sbp).toMatchObject({ warnLow: 80, critLow: 70 });
      });

      it('switches a limit off at the end of the range, or with null', () => {
        const e = running();
        e.setAlarmLimit('spo2', 'low', 0);
        expect(e.snapshot().alarmLimits!.spo2.warnLow).toBeUndefined();
        e.setAlarmLimit('hr', 'high', null);
        expect(e.snapshot().alarmLimits!.hr.warnHigh).toBeUndefined();
        expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'HR high alarm limit → off' });
        // The critical tier is untouched: it is not the clinician's to set.
        expect(e.snapshot().alarmLimits!.hr.critHigh).toBe(140);
        e.setVital('hr', 130);
        expect(e.snapshot().alarms).toEqual([]);
        e.setVital('hr', 145);
        expect(alarmOn(e, 'hr')).toMatchObject({ level: 'critical' });
      });

      it('keeps the low limit below the high one and inside the vital\'s range', () => {
        const e = running();
        e.setAlarmLimit('hr', 'low', 200);
        const hr = e.snapshot().alarmLimits!.hr;
        expect(hr.warnLow).toBe(hr.warnHigh! - ALARM_LIMIT_STEP.hr);
        e.setAlarmLimit('etco2', 'high', -5);
        const etco2 = e.snapshot().alarmLimits!.etco2;
        expect(etco2.warnHigh).toBe(etco2.warnLow! + ALARM_LIMIT_STEP.etco2);
        expect(alarmLimitProblems(e.snapshot().alarmLimits!)).toEqual([]);
      });

      it('switches one vital\'s alarms off and on without touching the others', () => {
        const e = running();
        e.setVital('hr', 150);
        e.setVital('spo2', 80);
        expect(alarmOn(e, 'hr')).toBeDefined();
        e.setAlarmOff('hr', true);
        expect(e.snapshot().alarmsOff).toEqual(['hr']);
        expect(alarmOn(e, 'hr')).toBeUndefined();
        expect(alarmOn(e, 'spo2')).toMatchObject({ level: 'critical' });
        expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'HR alarms off' });
        e.setAlarmOff('hr', false);
        expect(e.snapshot().alarmsOff).toEqual([]);
        expect(alarmOn(e, 'hr')).toMatchObject({ level: 'critical' });
      });

      it('still raises the lost-signal and rhythm alarms with the limit alarms off', () => {
        const e = running();
        e.setAlarmOff('spo2', true);
        e.setAlarmOff('hr', true);
        e.setRhythm('vfib');
        const alarms = e.snapshot().alarms.map((a) => a.message);
        expect(alarms).toContain('SpO₂ NO PULSE');
        expect(alarms.some((m) => m.startsWith('RHYTHM'))).toBe(true);
      });

      it('starts with the alarms a scenario leaves off, and reset restores limits and switches', () => {
        const e = running({ alarmsOff: ['spo2'] });
        expect(e.snapshot().alarmsOff).toEqual(['spo2']);
        e.setVital('spo2', 70);
        expect(alarmOn(e, 'spo2')).toBeUndefined();
        e.setAlarmOff('spo2', false);
        e.setAlarmOff('temp', true);
        e.setAlarmLimit('hr', 'high', 130);
        e.reset();
        expect(e.snapshot().alarmsOff).toEqual(['spo2']);
        expect(e.snapshot().alarmLimits).toEqual(ALARM_PROFILES.adult);
      });

      it('goes back to the category\'s limits when the category is switched', () => {
        const e = running();
        e.setAlarmLimit('hr', 'high', 130);
        e.setAlarmProfile('pediatric');
        e.setAlarmProfile('adult');
        expect(e.snapshot().alarmLimits).toEqual(ALARM_PROFILES.adult);
      });
    });

    describe('the Silence key', () => {
      const messages = (e: SimulationEngine) => e.snapshot().alarms.map((a) => [a.message, a.acknowledged ?? false]);

      it('acknowledges the alarms active now and leaves them listed', () => {
        const e = running();
        e.setVital('hr', 150);
        e.setVital('spo2', 88);
        e.acknowledgeAlarms();
        expect(messages(e)).toEqual([
          ['HR HIGH 150', true],
          ['SpO₂ low 88', true],
        ]);
        expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'Alarms silenced: HR HIGH 150, SpO₂ low 88' });
      });

      it('does nothing, and logs nothing, when there is nothing to silence', () => {
        const e = running();
        const before = e.getFullLog().length;
        e.acknowledgeAlarms();
        e.setVital('hr', 150);
        e.acknowledgeAlarms();
        e.acknowledgeAlarms(); // already silenced
        expect(e.getFullLog().length).toBe(before + 2); // the vital change and one silence
      });

      it('stays silenced while the number drifts, but a new alarm sounds', () => {
        const e = running();
        e.setVital('hr', 120);
        e.acknowledgeAlarms();
        e.setVital('hr', 125);
        expect(messages(e)).toEqual([['HR high 125', true]]);
        // Another vital: a new alarm.
        e.setVital('spo2', 88);
        expect(messages(e)).toEqual([
          ['HR high 125', true],
          ['SpO₂ low 88', false],
        ]);
        // The same vital, now critical: a new alarm too.
        e.setVital('hr', 150);
        expect(messages(e)[0]).toEqual(['HR HIGH 150', false]);
      });

      it('resets when the cause clears, so the same alarm coming back sounds again', () => {
        const e = running();
        e.setVital('hr', 120);
        e.acknowledgeAlarms();
        e.setVital('hr', 80);
        expect(e.snapshot().alarms).toEqual([]);
        e.setVital('hr', 120);
        expect(messages(e)).toEqual([['HR high 120', false]]);
      });

      it('treats a different rhythm as a new alarm', () => {
        const e = running();
        e.setRhythm('vtach', false);
        e.acknowledgeAlarms();
        expect(e.snapshot().alarms.find((a) => a.vital === 'rhythm')?.acknowledged).toBe(true);
        e.setRhythm('vfib', false);
        expect(e.snapshot().alarms.find((a) => a.vital === 'rhythm')?.acknowledged).toBeUndefined();
      });

      it('silences a cuff pressure only until the next reading', () => {
        const e = running();
        e.setVital('sbp', 80);
        e.cycleNibp();
        e.acknowledgeAlarms();
        expect(alarmOn(e, 'sbp')).toMatchObject({ acknowledged: true });
        e.tick(60);
        expect(alarmOn(e, 'sbp')).toMatchObject({ acknowledged: true }); // no new reading yet
        e.cycleNibp(); // still 80: an intermittent measurement alarms afresh
        expect(alarmOn(e, 'sbp')?.acknowledged).toBeUndefined();
      });

      it('is separate from the instructor\'s pause, and reset clears it', () => {
        const e = running();
        e.setVital('hr', 150);
        e.acknowledgeAlarms();
        expect(e.snapshot().alarmsSilenced).toBe(false);
        e.reset();
        e.start();
        e.setVital('hr', 150);
        expect(alarmOn(e, 'hr')?.acknowledged).toBeUndefined();
      });

      it('keeps the snapshot serializable with silenced alarms', () => {
        const e = running();
        e.setVital('hr', 150);
        e.acknowledgeAlarms();
        const snap = e.snapshot();
        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
      });
    });

    it('keeps the snapshot serializable with its limits', () => {
      const snap = running({ alarmProfile: 'neonatal', alarmLimits: { spo2: { warnLow: 88 } } }).snapshot();
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
  });

  describe('twitch monitor: train-of-four', () => {
    const withNmb = (nmb: Scenario['baselineVitals']['nmb'] = {}): Scenario => ({
      ...scenario(),
      baselineVitals: { ...scenario().baselineVitals, nmb },
    });
    const attached = (nmb?: Scenario['baselineVitals']['nmb']) => {
      const e = new SimulationEngine(withNmb(nmb), 'TEST');
      e.start();
      return e;
    };

    it('has no twitch monitor unless the scenario or the instructor attaches one', () => {
      const e = newEngine();
      expect(e.getTofAttached()).toBe(false);
      expect('tof' in e.snapshot()).toBe(false);
      expect('nmb' in e.getVitals()).toBe(false);
      e.start();
      e.setTofAttached(true);
      // Attaching measures at once: an unblocked patient, four equal twitches.
      expect(e.snapshot().tof).toEqual({ count: 4, ratio: 100, ptc: null, atSec: 0 });
      expect(e.getVitals().nmb).toEqual({ tofCount: 4, tofRatio: 100, ptc: 0 });
      e.setTofAttached(false);
      expect('tof' in e.snapshot()).toBe(false);
    });

    it('starts from the block the scenario states', () => {
      expect(attached({ tofCount: 2 }).snapshot().tof).toMatchObject({ count: 2, ratio: null, ptc: null });
      expect(attached({ tofCount: 0, ptc: 3 }).snapshot().tof).toMatchObject({ count: 0, ratio: null, ptc: 3 });
      expect(attached({ tofRatio: 60 }).snapshot().tof).toMatchObject({ count: 4, ratio: 60, ptc: null });
    });

    it('shows a change only when the monitor next stimulates, like the cuff', () => {
      const e = attached();
      e.setNmb({ tofCount: 0, ptc: 2 });
      expect(e.getVitals().nmb).toMatchObject({ tofCount: 0, ptc: 2 });
      expect(e.snapshot().tof).toMatchObject({ count: 4, ratio: 100 });
      e.tick(TOF_INTERVAL_SEC - 1);
      expect(e.snapshot().tof).toMatchObject({ count: 4 });
      e.tick(1);
      expect(e.snapshot().tof).toEqual({ count: 0, ratio: null, ptc: 2, atSec: TOF_INTERVAL_SEC });
    });

    it('stimulates on request without waiting for the interval', () => {
      const e = attached();
      e.setNmb({ tofCount: 1 });
      e.tick(2);
      e.measureTof();
      expect(e.snapshot().tof).toEqual({ count: 1, ratio: null, ptc: null, atSec: 2 });
    });

    it('measures no more often than trains may be repeated', () => {
      // At least 12 s between trains (Fuchs-Buder 2023, Table 3).
      expect(TOF_INTERVAL_SEC).toBeGreaterThanOrEqual(12);
    });

    it('ramps the count and the ratio over time', () => {
      const e = attached({ tofCount: 0 });
      e.setNmb({ tofCount: 4 }, 80);
      const counts: number[] = [];
      for (let i = 0; i < 4; i++) {
        e.tick(20);
        e.measureTof();
        counts.push(e.snapshot().tof!.count);
      }
      expect(counts).toEqual([1, 2, 3, 4]);
      e.setNmb({ tofRatio: 90 }, 90);
      e.tick(45);
      e.measureTof();
      expect(e.snapshot().tof!.ratio).toBe(45);
      e.tick(45);
      e.measureTof();
      expect(e.snapshot().tof!.ratio).toBe(90);
    });

    it('takes the ratio to zero when the fourth twitch goes, so it climbs from there on recovery', () => {
      const e = attached();
      e.setNmb({ tofCount: 2 });
      expect(e.getNmbTarget('tofRatio')).toBe(0);
      e.setNmb({ tofCount: 4 });
      e.measureTof();
      expect(e.snapshot().tof).toMatchObject({ count: 4, ratio: 0 });
      // Only the count was a decision: the ratio following it is not logged.
      expect(e.getFullLog().filter((l) => l.label.startsWith('TOF ratio'))).toEqual([]);
    });

    it('clamps to four twitches, 100% and the highest post-tetanic count', () => {
      const e = attached();
      e.setNmb({ tofCount: 9, tofRatio: 140 });
      expect(e.getVitals().nmb).toMatchObject({ tofCount: 4, tofRatio: 100 });
      e.setNmb({ tofCount: -1, ptc: 99 });
      expect(e.getVitals().nmb).toMatchObject({ tofCount: 0, ptc: PTC_MAX });
    });

    it('applies event effects and resets to the baseline block', () => {
      const s = withNmb({ tofCount: 2 });
      const ev: ScenarioEvent = {
        id: 'reversal',
        label: 'Reversal given',
        description: '',
        category: 'drug',
        effects: [{ nmb: { tofCount: 4, tofRatio: 95 } }],
      };
      const e = new SimulationEngine({ ...s, events: [...s.events, ev] }, 'TEST');
      e.start();
      e.triggerEvent('reversal');
      e.measureTof();
      expect(e.snapshot().tof).toMatchObject({ count: 4, ratio: 95 });
      e.reset();
      expect(e.snapshot().tof).toEqual({ count: 2, ratio: null, ptc: null, atSec: 0 });
    });

    it('logs a measurement only when the reading changes', () => {
      const e = attached();
      const readings = () => e.getFullLog().filter((l) => l.detail === 'twitch monitor').map((l) => l.label);
      e.tick(TOF_INTERVAL_SEC * 4);
      expect(readings()).toEqual([]);
      e.setNmb({ tofCount: 0, ptc: 1 });
      e.tick(TOF_INTERVAL_SEC * 3);
      expect(readings()).toEqual(['TOF count 0, PTC 1']);
      e.setNmb({ tofCount: 3 });
      e.tick(TOF_INTERVAL_SEC);
      e.setNmb({ tofCount: 4, tofRatio: 70 });
      e.tick(TOF_INTERVAL_SEC);
      expect(readings()).toEqual(['TOF count 0, PTC 1', 'TOF count 3', 'TOF 70%']);
    });

    it('grades depth of block by the ASA scheme', () => {
      const depth = (count: number, ratio: number | null, ptc: number | null) => blockDepth({ count, ratio, ptc });
      expect(depth(0, null, 0)).toBe('complete');
      expect(depth(0, null, 1)).toBe('deep');
      expect(depth(1, null, null)).toBe('moderate');
      expect(depth(3, null, null)).toBe('moderate');
      expect(depth(4, 39, null)).toBe('shallow');
      expect(depth(4, 40, null)).toBe('minimal');
      expect(depth(4, 89, null)).toBe('minimal');
      expect(depth(4, 90, null)).toBe('recovered');
      expect(depth(4, 100, null)).toBe('recovered');
    });

    it('keeps the snapshot serializable with the twitch monitor attached', () => {
      const e = attached({ tofCount: 0, ptc: 4 });
      e.setNmb({ tofCount: 4, tofRatio: 80 }, 60);
      e.tick(20);
      const snap = e.snapshot();
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
  });

  describe('capnography: inspired CO2 and the esophageal tube', () => {
    it('starts with no inspired CO2 and reports it in the vitals', () => {
      expect(newEngine().getVitals().fico2).toBe(0);
    });

    it('starts from the scenario baseline when it sets one', () => {
      const s: Scenario = { ...scenario(), baselineVitals: { ...scenario().baselineVitals, fico2: 6 } };
      expect(new SimulationEngine(s, 'TEST').getVitals().fico2).toBe(6);
    });

    it('ramps inspired CO2 like a numeric vital, clamped to 0–30 mmHg', () => {
      const e = newEngine();
      e.start();
      e.setFico2(8, 40);
      expect(e.getFico2Target()).toBe(8);
      e.tick(10);
      expect(e.getVitals().fico2).toBeCloseTo(2, 5);
      e.tick(40);
      expect(e.getVitals().fico2).toBe(8);
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'FiCO₂ → 8 mmHg', detail: 'over 40s' });
      e.setFico2(99);
      expect(e.getVitals().fico2).toBe(30);
      e.setFico2(-5);
      expect(e.getVitals().fico2).toBe(0);
    });

    it('is driven by authored effects and returns to baseline on reset', () => {
      const e = newEngine();
      e.start();
      e.applyNamedEffect('Absorbent exhausted', { fico2: 10, overSec: 20 });
      e.tick(10);
      expect(e.getVitals().fico2).toBeCloseTo(5, 5);
      e.reset();
      expect(e.getVitals().fico2).toBe(0);
    });

    it('leaves EtCO2 alone, and alarms once inspired CO2 passes 4 mmHg', () => {
      const e = newEngine();
      e.start();
      const before = e.snapshot();
      e.setFico2(4);
      expect(e.snapshot().alarms).toEqual(before.alarms); // at the limit: quiet
      e.setFico2(8);
      const after = e.snapshot();
      expect(after.vitals.etco2).toBe(before.vitals.etco2);
      expect(after.alarms).toEqual([{ vital: 'etco2', level: 'warning', message: 'FiCO₂ high 8' }]);
      e.setFico2(0);
      expect(e.snapshot().alarms).toEqual(before.alarms);
    });

    it('caps the first esophageal reading at what the patient would really show', () => {
      const e = newEngine();
      e.start();
      e.setVital('etco2', 4);
      e.setCapnoShape('esophageal');
      expect(e.snapshot().vitals.etco2).toBe(4);
    });

    it('shows a little CO2 that dies away over six breaths with a tube in the esophagus', () => {
      const e = newEngine();
      e.start();
      e.setVital('rr', 12); // one breath every 5 s
      e.setVital('etco2', 40);
      e.setCapnoShape('esophageal');
      const measured = () => e.snapshot().vitals.etco2;
      const readings = [measured()];
      for (let breath = 1; breath < 6; breath++) {
        e.tick(5);
        readings.push(measured());
      }
      // Starts under 10 mmHg and under the 7.5 mmHg a tracheal trace must clear…
      expect(readings[0]).toBeLessThan(7.5);
      expect(readings[0]).toBeGreaterThan(0);
      // …and falls with every breath — never the sustained trace of a tracheal tube.
      for (let i = 1; i < readings.length; i++) expect(readings[i]).toBeLessThanOrEqual(readings[i - 1]);
      expect(readings[5]).toBeLessThan(readings[0] / 3);
      e.tick(5);
      expect(measured()).toBe(0); // nothing from the seventh breath on
      e.tick(60);
      expect(measured()).toBe(0);
      // What the patient would show from the trachea is untouched…
      expect(e.getVitals().etco2).toBe(40);
      // …and the monitor alarms on what it measures.
      expect(e.snapshot().alarms.some((a) => a.vital === 'etco2' && a.level === 'critical')).toBe(true);
    });

    it('reads normally again as soon as the tube is back in the trachea', () => {
      const e = newEngine();
      e.start();
      e.setVital('etco2', 38);
      e.setCapnoShape('esophageal');
      e.tick(120);
      expect(e.snapshot().vitals.etco2).toBe(0);
      e.setCapnoShape('normal');
      expect(e.snapshot().vitals.etco2).toBe(38);
      // A second misplacement starts its own decay from the top.
      e.setCapnoShape('esophageal');
      expect(e.snapshot().vitals.etco2).toBe(7);
    });

    it('leaves the EtCO2 number alone for the display-only shapes', () => {
      for (const shape of ['bronchospasm', 'curare_cleft', 'cardiogenic', 'leak'] as const) {
        const e = newEngine();
        e.start();
        const etco2 = e.snapshot().vitals.etco2;
        e.setCapnoShape(shape);
        e.tick(60);
        expect(e.snapshot().vitals.etco2).toBe(etco2);
      }
    });
  });

  describe('pulse, separate from the rhythm', () => {
    const cuffScenario = (): Scenario => ({ ...scenario(), monitoring: { nibpIntervalSec: 120 } });
    const engineWithCuff = () => new SimulationEngine(cuffScenario(), 'TEST');
    const spo2Alarm = (e: SimulationEngine) => e.snapshot().alarms.find((a) => a.vital === 'spo2');

    it('starts with a pulse, and reports the flag in the vitals', () => {
      const e = newEngine();
      expect(e.getVitals().pulseless).toBe(false);
    });

    it('can start pulseless from the scenario baseline', () => {
      const s: Scenario = { ...scenario(), baselineVitals: { ...scenario().baselineVitals, pulseless: true } };
      expect(new SimulationEngine(s, 'TEST').getVitals().pulseless).toBe(true);
    });

    it('takes the pulse away without touching the rhythm or any number (PEA)', () => {
      const e = newEngine();
      e.start();
      const before = e.getVitals();
      e.setPulseless(true);
      const after = e.getVitals();
      expect(after).toEqual({ ...before, pulseless: true });
      expect(e.snapshot().log.at(-1)).toMatchObject({ kind: 'vital_change', label: 'Pulse → absent' });
    });

    it('raises only an oximeter no-pulse warning for PEA — no rhythm alarm, the heart rate looks fine', () => {
      const e = newEngine();
      e.start();
      expect(e.snapshot().alarms).toEqual([]);
      e.setPulseless(true);
      const alarms = e.snapshot().alarms;
      expect(alarms).toEqual([{ vital: 'spo2', level: 'warning', message: 'SpO₂ NO PULSE' }]);
    });

    it('names the lost pulse rather than a saturation, at the level the saturation would alarm', () => {
      const e = newEngine();
      e.start();
      e.setVital('spo2', 60);
      expect(spo2Alarm(e)).toMatchObject({ level: 'critical', message: 'SpO₂ LOW 60' });
      e.setPulseless(true);
      expect(spo2Alarm(e)).toEqual({ vital: 'spo2', level: 'critical', message: 'SpO₂ NO PULSE' });
      e.setPulseless(false);
      expect(spo2Alarm(e)).toMatchObject({ message: 'SpO₂ LOW 60' });
    });

    it('raises the no-pulse alarm in every rhythm that cannot perfuse', () => {
      for (const rhythm of ['vfib', 'asystole', 'pea', 'torsades'] as const) {
        const e = newEngine();
        e.start();
        e.setRhythm(rhythm);
        expect(spo2Alarm(e)?.message).toBe('SpO₂ NO PULSE');
        expect(e.snapshot().alarms.some((a) => a.vital === 'rhythm' && a.level === 'critical')).toBe(true);
      }
    });

    it('keeps the flag when the rhythm changes, until it is given back', () => {
      const e = newEngine();
      e.start();
      e.setRhythm('vtach');
      e.setPulseless(true); // pulseless VT
      e.setRhythm('sinus'); // an organized rhythm returns — still no pulse: PEA
      expect(e.getVitals().pulseless).toBe(true);
      e.setPulseless(false); // return of circulation
      expect(e.getVitals().pulseless).toBe(false);
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'Pulse → present' });
    });

    it('is driven by authored effects', () => {
      const e = newEngine();
      e.start();
      e.applyNamedEffect('PEA arrest', { rhythm: 'sinus_tach', pulseless: true });
      expect(e.getVitals()).toMatchObject({ rhythm: 'sinus_tach', pulseless: true });
      e.applyNamedEffect('ROSC', { pulseless: false });
      expect(e.getVitals().pulseless).toBe(false);
    });

    it('fails the cuff with no pulse, whatever pressure the scenario holds', () => {
      const e = engineWithCuff();
      e.start();
      const pressure = e.getVitals().sbp;
      expect(pressure).toBeGreaterThan(60);
      e.setPulseless(true);
      e.cycleNibp();
      expect(e.snapshot().nibp).toMatchObject({ sbp: 0, dbp: 0 });
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'NIBP — no reading' });
      // The same in a rhythm that cannot perfuse.
      e.setPulseless(false);
      e.setRhythm('vfib');
      e.cycleNibp();
      expect(e.snapshot().nibp).toMatchObject({ sbp: 0, dbp: 0 });
      // With a pulse back, the cuff reads again.
      e.setRhythm('sinus');
      e.cycleNibp();
      expect(e.snapshot().nibp?.sbp).toBe(Math.round(pressure));
    });

    it('logs nothing when the pulse is already as asked', () => {
      const e = newEngine();
      e.start();
      const before = e.getFullLog().length;
      e.setPulseless(false);
      expect(e.getFullLog().length).toBe(before);
    });

    it('returns to the baseline on reset', () => {
      const e = newEngine();
      e.start();
      e.setPulseless(true);
      e.reset();
      expect(e.getVitals().pulseless).toBe(false);
    });
  });

  describe('escape rhythms', () => {
    it('bring a faster heart rate into their range once, on selection', () => {
      for (const [rhythm, hr] of [
        ['junctional', 50],
        ['av_block_3', 45],
        ['idioventricular', 35],
      ] as const) {
        const e = newEngine();
        e.start();
        e.setVital('hr', 80);
        e.setRhythm(rhythm);
        e.tick(6);
        expect(e.getVitals().hr).toBe(hr);
        // The instructor stays free to re-dial it (accelerated variants).
        e.setVital('hr', 80);
        expect(e.getVitals().hr).toBe(80);
      }
    });

    it('leave a rate already in range alone', () => {
      const e = newEngine();
      e.start();
      e.setVital('hr', 44);
      e.setRhythm('junctional');
      e.tick(6);
      expect(e.getVitals().hr).toBe(44);
    });

    it('do not override a rate the same authored effect sets', () => {
      const e = newEngine();
      e.start();
      e.applyNamedEffect('Accelerated junctional', { rhythm: 'junctional', vitals: { hr: 85 } });
      e.tick(6);
      expect(e.getVitals().hr).toBe(85);
    });
  });

  describe('ECG morphology', () => {
    const lastLog = (e: SimulationEngine) => e.snapshot().log.at(-1);

    it('starts normal when the scenario sets none', () => {
      const e = newEngine();
      expect(e.getVitals().ecg).toEqual({ stMm: 0, stV5Mm: 0, tWave: 'normal', qrs: 'normal', qt: 'normal' });
      expect(e.getStTarget()).toBe(0);
    });

    it('starts from the scenario baseline, filling in what it leaves out', () => {
      const s: Scenario = {
        ...scenario(),
        baselineVitals: { ...scenario().baselineVitals, ecg: { stMm: -1, tWave: 'inverted' } },
      };
      const e = new SimulationEngine(s, 'TEST');
      expect(e.getVitals().ecg).toEqual({ stMm: -1, stV5Mm: 0, tWave: 'inverted', qrs: 'normal', qt: 'normal' });
    });

    it('sets the ST level instantly by default and logs it', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: -2 });
      expect(e.getVitals().ecg?.stMm).toBe(-2);
      expect(lastLog(e)).toMatchObject({ kind: 'vital_change', label: 'ST II → −2.0 mm' });
    });

    it('ramps the ST level linearly, like a numeric vital', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: -2 }, 60);
      expect(e.getStTarget()).toBe(-2);
      expect(e.getVitals().ecg?.stMm).toBe(0);
      e.tick(15);
      expect(e.getVitals().ecg?.stMm).toBeCloseTo(-0.5, 5);
      e.tick(30);
      expect(e.getVitals().ecg?.stMm).toBeCloseTo(-1.5, 5);
      e.tick(60);
      expect(e.getVitals().ecg?.stMm).toBe(-2);
      expect(lastLog(e)).toMatchObject({ label: 'ST II → −2.0 mm', detail: 'over 60s' });
    });

    it('can be redirected mid-ramp, back towards baseline', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: 3 }, 30);
      e.tick(10); // at +1
      e.setEcg({ stMm: 0 }, 10);
      e.tick(5);
      expect(e.getVitals().ecg?.stMm).toBeCloseTo(0.5, 5);
      e.tick(10);
      expect(e.getVitals().ecg?.stMm).toBe(0);
    });

    it('clamps the ST level to ±5 mm', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: 9 });
      expect(e.getVitals().ecg?.stMm).toBe(5);
      e.setEcg({ stMm: -9 });
      expect(e.getVitals().ecg?.stMm).toBe(-5);
    });

    it('switches T wave, QRS width and QT at once, changing only what is listed', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ tWave: 'peaked', qrs: 'wide' }, 60); // the ramp does not apply to these
      expect(e.getVitals().ecg).toEqual({ stMm: 0, stV5Mm: 0, tWave: 'peaked', qrs: 'wide', qt: 'normal' });
      e.setEcg({ qt: 'long' });
      expect(e.getVitals().ecg).toEqual({ stMm: 0, stV5Mm: 0, tWave: 'peaked', qrs: 'wide', qt: 'long' });
      expect(lastLog(e)).toMatchObject({ label: 'QT → Prolonged' });
    });

    it('logs nothing when nothing changes', () => {
      const e = newEngine();
      e.start();
      const before = e.getFullLog().length;
      e.setEcg({ stMm: 0, stV5Mm: 0, tWave: 'normal', qrs: 'normal', qt: 'normal' });
      e.setEcg({});
      expect(e.getFullLog().length).toBe(before);
    });

    it('is driven by authored effects, with the ST level following overSec', () => {
      const e = newEngine();
      e.start();
      e.applyNamedEffect('ST depression', { ecg: { stMm: -2, tWave: 'flat' }, overSec: 40 });
      expect(e.getVitals().ecg?.tWave).toBe('flat');
      e.tick(20);
      expect(e.getVitals().ecg?.stMm).toBeCloseTo(-1, 5);
      e.tick(20);
      expect(e.getVitals().ecg?.stMm).toBe(-2);
    });

    it('changes no number and raises no alarm', () => {
      const e = newEngine();
      e.start();
      const { ecg: _before, ...numbers } = e.getVitals();
      const alarms = e.snapshot().alarms;
      e.setEcg({ stMm: -4, tWave: 'inverted', qrs: 'wide', qt: 'long' });
      const { ecg: _after, ...after } = e.getVitals();
      expect(after).toEqual(numbers);
      expect(e.snapshot().alarms).toEqual(alarms);
    });

    it('returns to the baseline on reset, dropping any ramp', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: -3, qrs: 'wide' }, 60);
      e.tick(10);
      e.reset();
      expect(e.getVitals().ecg).toEqual({ stMm: 0, stV5Mm: 0, tWave: 'normal', qrs: 'normal', qt: 'normal' });
      e.start();
      e.tick(30);
      expect(e.getVitals().ecg?.stMm).toBe(0);
    });

    it('ramps the V5 ST level separately from lead II', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stV5Mm: -3 }, 60);
      e.setEcg({ stMm: -1 }, 10);
      expect(e.getStTarget('V5')).toBe(-3);
      expect(e.getStTarget('II')).toBe(-1);
      e.tick(10);
      expect(e.getVitals().ecg).toMatchObject({ stMm: -1, stV5Mm: -0.5 });
      e.tick(50);
      expect(e.getVitals().ecg).toMatchObject({ stMm: -1, stV5Mm: -3 });
      const labels = e.getFullLog().map((l) => l.label);
      expect(labels).toContain('ST V5 → −3.0 mm');
      expect(labels).toContain('ST II → −1.0 mm');
    });

    it('shows a V5 lead when the scenario asks for one, and lets faculty add or remove it', () => {
      expect(newEngine().snapshot().v5Lead).toBe(false);
      const withV5: Scenario = { ...scenario(), monitoring: { ...scenario().monitoring, v5: true } };
      const e = new SimulationEngine(withV5, 'TEST');
      expect(e.snapshot().v5Lead).toBe(true);
      e.start();
      e.setV5Lead(false);
      expect(e.snapshot().v5Lead).toBe(false);
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'V5 lead removed' });
      e.setV5Lead(true);
      expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'V5 lead added' });
      e.setV5Lead(false);
      e.reset();
      expect(e.snapshot().v5Lead).toBe(true); // back to the scenario's setting
    });

    it('stays serializable in the snapshot', () => {
      const e = newEngine();
      e.start();
      e.setEcg({ stMm: -1.5, tWave: 'inverted' }, 20);
      e.tick(7);
      const snap = e.snapshot();
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
      expect(snap.vitals.ecg?.tWave).toBe('inverted');
    });
  });

  describe('pre-brief (what student displays show before the start)', () => {
    const withBrief = (s: Scenario = scenario()) => new SimulationEngine(s, 'TEST', { preBrief: true });

    it('is off unless the instructor turns it on', () => {
      const e = newEngine();
      expect(e.getPreBriefEnabled()).toBe(false);
      expect('preBrief' in e.snapshot()).toBe(false);
      e.setPreBrief(true);
      expect(e.snapshot().preBrief).toEqual({ patient: scenario().patient });
    });

    it('carries the patient and nothing that gives the case away, for every built-in scenario', () => {
      for (const s of BUILT_IN_SCENARIOS) {
        const idle = withBrief(s).snapshot();
        expect(Object.keys(idle.preBrief ?? {})).toEqual(['patient']);
        // Nothing in an idle snapshot holds the case's title, summary,
        // objectives or event labels — the snapshot is broadcast to learners.
        const wire = JSON.stringify(idle);
        for (const secret of [s.title, s.summary, ...s.learningObjectives, ...s.events.map((ev) => ev.label)]) {
          expect(wire, `${s.id}: "${secret}"`).not.toContain(secret);
        }
      }
    });

    it('is gone once the scenario runs, pauses or ends', () => {
      const e = withBrief();
      expect(e.snapshot().preBrief).toBeDefined();
      e.start();
      expect('preBrief' in e.snapshot()).toBe(false);
      e.tick(5);
      e.pause();
      expect('preBrief' in e.snapshot()).toBe(false);
      e.end();
      expect('preBrief' in e.snapshot()).toBe(false);
    });

    it('returns after a reset, and the choice survives it either way', () => {
      const e = withBrief();
      e.start();
      e.tick(5);
      e.reset();
      expect(e.snapshot().preBrief).toEqual({ patient: scenario().patient });
      e.setPreBrief(false);
      e.start();
      e.reset();
      expect('preBrief' in e.snapshot()).toBe(false);
    });

    it('keeps the idle snapshot serializable', () => {
      const snap = withBrief().snapshot();
      expect(snap.preBrief).toBeDefined();
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
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
