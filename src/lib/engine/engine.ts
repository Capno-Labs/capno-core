import type {
  ActionRecord,
  ActionStatus,
  CapnoShape,
  FacultyNote,
  LogEntry,
  NibpReading,
  NumericVitals,
  Rhythm,
  Scenario,
  ScenarioEvent,
  SimSnapshot,
  SimStatus,
  VitalEffect,
  Vitals,
  VitalsHistorySample,
} from './types';
import { CAPNO_SHAPE_LABELS, NUMERIC_VITAL_KEYS, RHYTHM_LABELS } from './types';
import { clampVital, evaluateAlarms, roundVital, VITAL_META } from './vitals';

/**
 * SimulationEngine — a deterministic, tick-driven state machine for one
 * scenario session.
 *
 * The engine is authoritative on exactly one client (the faculty controller).
 * It has no timers of its own: the host calls `tick(dtSec)` on whatever
 * cadence it likes (the UI uses 500 ms). All time inside the engine is
 * elapsed *scenario* seconds, so pausing simply means not ticking.
 *
 * Numeric vitals ramp linearly toward per-vital targets, which makes
 * faculty-driven changes look like real physiology on the student monitor
 * instead of stepping instantly.
 */
const HISTORY_SAMPLE_SEC = 10;
/** ~8 h at one sample per 10 s — a generous ceiling, not a real limit. */
const MAX_HISTORY_SAMPLES = 2880;

export class SimulationEngine {
  readonly scenario: Scenario;
  readonly sessionId: string;

  private status: SimStatus = 'idle';
  private elapsedSec = 0;
  private phaseId: string;
  private rhythm: Rhythm;
  private capnoShape: CapnoShape;

  /** Current interpolated values. */
  private current: NumericVitals;
  /** Per-vital ramp: target value + rate (units/sec). Absent = at rest. */
  private ramps = new Map<keyof NumericVitals, { target: number; ratePerSec: number }>();
  /** Effects scheduled for a future elapsed time (from afterSec / autoAtSec). */
  private pendingEffects: { atSec: number; effect: VitalEffect; sourceLabel: string }[] = [];

  private log: LogEntry[] = [];
  private notes: FacultyNote[] = [];
  private actions: ActionRecord[];
  private firedEventIds = new Set<string>();
  private alarmsSilenced = false;

  /** Arterial line in place: continuous BP, no cuff. Faculty can toggle at runtime. */
  private artLine: boolean;
  /** Last cuff reading (null while an arterial line is in place). */
  private lastNibp: NibpReading | null = null;
  /** Low-frequency vitals record for the debrief trend strip (archive-only). */
  private history: VitalsHistorySample[] = [];
  private lastHistorySec = Number.NEGATIVE_INFINITY;

  constructor(scenario: Scenario, sessionId: string) {
    this.scenario = scenario;
    this.sessionId = sessionId;
    this.phaseId = scenario.phases[0]?.id ?? 'main';
    const { rhythm, capnoShape, ...numeric } = scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.current = { ...numeric };
    this.actions = scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = scenario.monitoring?.artLine ?? false;
    if (this.usesCuff()) {
      this.lastNibp = { sbp: numeric.sbp, dbp: numeric.dbp, atSec: 0 };
    }
  }

  private usesCuff(): boolean {
    return !this.artLine;
  }

  private nibpIntervalSec(): number {
    return this.scenario.monitoring?.nibpIntervalSec ?? 180;
  }

  // ── Session control ────────────────────────────────────────────────────────

  start(): void {
    if (this.status === 'running') return;
    if (this.status === 'idle') {
      this.addLog('session', 'Scenario started');
      // Queue scenario-defined automatic events (skip any already fired
      // manually while idle — e.g. from the script rail during setup).
      for (const ev of this.scenario.events) {
        if (ev.autoAtSec !== undefined && !this.firedEventIds.has(ev.id)) {
          for (const effect of ev.effects) {
            this.pendingEffects.push({
              atSec: ev.autoAtSec + (effect.afterSec ?? 0),
              effect,
              sourceLabel: ev.label,
            });
          }
        }
      }
    } else {
      this.addLog('session', 'Scenario resumed');
    }
    this.status = 'running';
    if (this.history.length === 0) this.recordHistorySample();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.addLog('session', 'Scenario paused');
  }

  /** End the session; pending actions become 'missed'. */
  end(): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    for (const rec of this.actions) {
      if (rec.status === 'pending') rec.status = 'missed';
    }
    // Close the trend record at the final moment.
    if (this.history.length > 0 && this.elapsedSec > this.lastHistorySec) {
      this.recordHistorySample();
    }
    this.addLog('session', 'Scenario ended');
  }

  /** Reset to baseline (fresh log, fresh actions, elapsed 0). */
  reset(): void {
    this.status = 'idle';
    this.elapsedSec = 0;
    this.phaseId = this.scenario.phases[0]?.id ?? 'main';
    const { rhythm, capnoShape, ...numeric } = this.scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.current = { ...numeric };
    this.ramps.clear();
    this.pendingEffects = [];
    this.log = [];
    this.notes = [];
    this.firedEventIds.clear();
    this.alarmsSilenced = false;
    this.actions = this.scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = this.scenario.monitoring?.artLine ?? false;
    this.lastNibp = this.usesCuff()
      ? { sbp: this.scenario.baselineVitals.sbp, dbp: this.scenario.baselineVitals.dbp, atSec: 0 }
      : null;
    this.history = [];
    this.lastHistorySec = Number.NEGATIVE_INFINITY;
  }

  // ── Time ───────────────────────────────────────────────────────────────────

  /** Advance the simulation by `dtSec` scenario-seconds. No-op unless running. */
  tick(dtSec: number): void {
    if (this.status !== 'running' || dtSec <= 0) return;
    this.advance(dtSec);
  }

  /**
   * Skip scenario time forward (e.g. through an uneventful maintenance
   * stretch). Works while running or paused; due auto events fire and vital
   * ramps progress. Advances in small chunks so effects that start mid-skip
   * (delayed effects, auto events) still ramp within the skipped window.
   */
  skipAhead(sec: number): void {
    if (sec <= 0 || this.status === 'idle' || this.status === 'ended') return;
    let remaining = sec;
    while (remaining > 0) {
      const step = Math.min(5, remaining);
      this.advance(step);
      remaining -= step;
    }
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    this.addLog('session', `Skipped ahead +${m}:${String(s).padStart(2, '0')}`);
  }

  private advance(dtSec: number): void {
    this.elapsedSec += dtSec;

    // Fire any effects whose time has come (auto events / delayed effects).
    const due = this.pendingEffects.filter((p) => p.atSec <= this.elapsedSec);
    this.pendingEffects = this.pendingEffects.filter((p) => p.atSec > this.elapsedSec);
    for (const p of due) {
      // Auto events log once via their owning event on first effect application.
      const autoEvent = this.scenario.events.find(
        (e) => e.label === p.sourceLabel && e.autoAtSec !== undefined && !this.firedEventIds.has(e.id),
      );
      if (autoEvent) {
        this.firedEventIds.add(autoEvent.id);
        this.addLog('event', autoEvent.label, 'automatic');
      }
      this.applyEffectNow(p.effect);
    }

    // Ramp numeric vitals toward targets.
    for (const [key, ramp] of this.ramps) {
      const cur = this.current[key];
      const step = ramp.ratePerSec * dtSec;
      const next =
        cur < ramp.target ? Math.min(ramp.target, cur + step) : Math.max(ramp.target, cur - step);
      this.current[key] = next;
      if (next === ramp.target) this.ramps.delete(key);
    }

    // Automatic NIBP cuff cycle.
    if (this.lastNibp && this.elapsedSec - this.lastNibp.atSec >= this.nibpIntervalSec()) {
      this.cycleNibp();
    }

    // Vitals history sample every 10 s (archive-only; not broadcast).
    if (this.elapsedSec - this.lastHistorySec >= HISTORY_SAMPLE_SEC) {
      this.recordHistorySample();
    }
  }

  /** Take an NIBP reading now (automatic interval or faculty "cycle cuff"). */
  cycleNibp(): void {
    if (!this.usesCuff()) return;
    this.lastNibp = {
      sbp: Math.round(this.current.sbp),
      dbp: Math.round(this.current.dbp),
      atSec: this.elapsedSec,
    };
    this.addLog('vital_change', `NIBP ${this.lastNibp.sbp}/${this.lastNibp.dbp}`, 'cuff cycle');
  }

  /** Place or remove an arterial line at runtime (faculty toggle). */
  setArtLine(on: boolean): void {
    if (on === this.artLine) return;
    this.artLine = on;
    if (on) {
      this.lastNibp = null;
      this.addLog('vital_change', 'Arterial line placed', 'continuous BP');
    } else {
      this.addLog('vital_change', 'Arterial line removed', 'NIBP cuff mode');
      this.cycleNibp(); // immediate reading so the BP display is never blank
    }
  }

  private recordHistorySample(): void {
    this.lastHistorySec = this.elapsedSec;
    this.history.push({
      t: Math.floor(this.elapsedSec),
      hr: Math.round(this.current.hr),
      sbp: Math.round(this.current.sbp),
      dbp: Math.round(this.current.dbp),
      spo2: Math.round(this.current.spo2),
      etco2: Math.round(this.current.etco2),
      rr: Math.round(this.current.rr),
      temp: Math.round(this.current.temp * 10) / 10,
    });
    if (this.history.length > MAX_HISTORY_SAMPLES) this.history.shift();
  }

  // ── Faculty commands ───────────────────────────────────────────────────────

  /** Set a single numeric vital target, ramping over `overSec` seconds. */
  setVital(key: keyof NumericVitals, target: number, overSec = 0): void {
    const clamped = clampVital(key, target);
    this.startRamp(key, clamped, overSec);
    const meta = VITAL_META[key];
    this.addLog(
      'vital_change',
      `${meta.label} → ${roundVital(key, clamped)}${meta.unit ? ' ' + meta.unit : ''}`,
      overSec > 0 ? `over ${overSec}s` : undefined,
    );
  }

  setRhythm(rhythm: Rhythm): void {
    if (rhythm === this.rhythm) return;
    this.rhythm = rhythm;
    this.addLog('vital_change', `Rhythm → ${RHYTHM_LABELS[rhythm]}`);
  }

  setCapnoShape(shape: CapnoShape): void {
    if (shape === this.capnoShape) return;
    this.capnoShape = shape;
    this.addLog('vital_change', `CO₂ waveform → ${CAPNO_SHAPE_LABELS[shape]}`);
  }

  /** Fire a scenario-defined event by id (faculty trigger). */
  triggerEvent(eventId: string): ScenarioEvent | undefined {
    const ev = this.scenario.events.find((e) => e.id === eventId);
    if (!ev) return undefined;
    // Firing an auto event early cancels its scheduled copy — otherwise the
    // queued effects would re-apply at autoAtSec and stomp later adjustments.
    this.pendingEffects = this.pendingEffects.filter((p) => p.sourceLabel !== ev.label);
    this.firedEventIds.add(ev.id);
    this.addLog('event', ev.label, ev.description);
    for (const effect of ev.effects) {
      const delay = effect.afterSec ?? 0;
      if (delay > 0) {
        this.pendingEffects.push({ atSec: this.elapsedSec + delay, effect, sourceLabel: ev.label });
      } else {
        this.applyEffectNow(effect);
      }
    }
    return ev;
  }

  /**
   * Apply an ad-hoc vitals bundle (a faculty preset) as one logged change.
   * Unlike a series of setVital calls, this writes a single log entry so a
   * preset reads as one clinical development in the debrief timeline. The
   * effect goes through the same ramp/delay machinery as scenario events.
   */
  applyNamedEffect(label: string, effect: VitalEffect): void {
    this.addLog(
      'vital_change',
      label,
      effect.overSec && effect.overSec > 0 ? `over ${effect.overSec}s` : undefined,
    );
    const delay = effect.afterSec ?? 0;
    if (delay > 0) {
      this.pendingEffects.push({ atSec: this.elapsedSec + delay, effect, sourceLabel: label });
    } else {
      this.applyEffectNow(effect);
    }
  }

  setPhase(phaseId: string): void {
    const phase = this.scenario.phases.find((p) => p.id === phaseId);
    if (!phase || phaseId === this.phaseId) return;
    this.phaseId = phaseId;
    this.addLog('phase', `Phase: ${phase.label}`);
  }

  markAction(actionId: string, status: ActionStatus): void {
    const rec = this.actions.find((a) => a.actionId === actionId);
    const def = this.scenario.expectedActions.find((a) => a.id === actionId);
    if (!rec || !def) return;
    rec.status = status;
    rec.markedAtSec = status === 'pending' ? undefined : this.elapsedSec;
    if (status !== 'pending') {
      this.addLog('action', def.label, status);
    }
  }

  addNote(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.notes.push({ t: this.elapsedSec, text: trimmed });
    this.addLog('note', trimmed);
  }

  setAlarmsSilenced(silenced: boolean): void {
    this.alarmsSilenced = silenced;
  }

  // ── Introspection ──────────────────────────────────────────────────────────

  getStatus(): SimStatus {
    return this.status;
  }

  getElapsedSec(): number {
    return this.elapsedSec;
  }

  getVitals(): Vitals {
    const rounded = {} as NumericVitals;
    for (const key of NUMERIC_VITAL_KEYS) rounded[key] = roundVital(key, this.current[key]);
    return { ...rounded, rhythm: this.rhythm, capnoShape: this.capnoShape };
  }

  /** Archive-only vitals record (not part of broadcast snapshots). */
  getHistory(): VitalsHistorySample[] {
    return [...this.history];
  }

  snapshot(): SimSnapshot {
    const vitals = this.getVitals();
    // In cuff mode, BP alarms judge the last *measured* reading — an alarm
    // must not reveal a pressure the monitor has not yet measured.
    const alarmVitals = this.lastNibp
      ? { ...vitals, sbp: this.lastNibp.sbp, dbp: this.lastNibp.dbp }
      : vitals;
    return {
      scenarioId: this.scenario.id,
      sessionId: this.sessionId,
      status: this.status,
      elapsedSec: Math.floor(this.elapsedSec),
      phaseId: this.phaseId,
      vitals,
      nibp: this.lastNibp ? { ...this.lastNibp, atSec: Math.floor(this.lastNibp.atSec) } : null,
      alarms: evaluateAlarms(alarmVitals),
      alarmsSilenced: this.alarmsSilenced,
      actions: this.actions.map((a) => ({ ...a })),
      log: [...this.log],
      notes: [...this.notes],
      firedEventIds: [...this.firedEventIds],
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private applyEffectNow(effect: VitalEffect): void {
    if (effect.rhythm) this.setRhythm(effect.rhythm);
    if (effect.capnoShape) this.setCapnoShape(effect.capnoShape);
    if (effect.vitals) {
      for (const key of NUMERIC_VITAL_KEYS) {
        const target = effect.vitals[key];
        if (target !== undefined) this.startRamp(key, clampVital(key, target), effect.overSec ?? 0);
      }
    }
  }

  private startRamp(key: keyof NumericVitals, target: number, overSec: number): void {
    if (overSec <= 0) {
      this.ramps.delete(key);
      this.current[key] = target;
      return;
    }
    const distance = Math.abs(target - this.current[key]);
    if (distance === 0) {
      this.ramps.delete(key);
      return;
    }
    this.ramps.set(key, { target, ratePerSec: distance / overSec });
  }

  private addLog(kind: LogEntry['kind'], label: string, detail?: string): void {
    this.log.push({ t: Math.floor(this.elapsedSec), kind, label, detail });
  }
}

/** Generate a short human-readable session code (e.g. "KX3Q"). */
export function generateSessionId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no easily-confused chars
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
