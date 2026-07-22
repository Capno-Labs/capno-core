import type {
  ActionRecord,
  ActionStatus,
  CapnoShape,
  FacultyNote,
  LogEntry,
  NibpReading,
  NumericVitals,
  PvcFrequency,
  Rhythm,
  Scenario,
  ScenarioEvent,
  SimSnapshot,
  SimStatus,
  VitalEffect,
  Vitals,
  VitalsHistorySample,
} from './types';
import {
  CAPNO_SHAPE_LABELS,
  NUMERIC_VITAL_KEYS,
  PVC_FREQUENCY_LABELS,
  RHYTHM_LABELS,
} from './types';
import { clampVital, evaluateAlarms, maxDbpFor, measuredEtco2, roundVital, VITAL_META } from './vitals';

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
/** Snapshots broadcast twice a second, so they carry only the newest log
 *  entries — an uncapped log would grow every message with session length.
 *  The full log stays in the engine (`getFullLog()`) for the archive. */
const SNAPSHOT_LOG_TAIL = 100;

export class SimulationEngine {
  readonly scenario: Scenario;
  readonly sessionId: string;

  /**
   * The session's working event list: the authored events plus any added
   * live by the instructor (addEvent). The scenario object itself is never
   * mutated — ad-hoc events exist only for this engine's lifetime and reach
   * the archive via getEffectiveScenario().
   */
  private events: ScenarioEvent[];
  /**
   * Instructor override for what "next up" means (see flow.ts
   * nextUnfiredEvent). A fired or unknown pin is simply ignored there, so no
   * clear-on-fire bookkeeping is needed; reset() clears it.
   */
  private pinnedNextEventId: string | null = null;

  private status: SimStatus = 'idle';
  private elapsedSec = 0;
  private phaseId: string;
  /** Elapsed time at the last phase change, for the stepper's phase timer. */
  private phaseChangedAtSec = 0;
  private rhythm: Rhythm;
  private capnoShape: CapnoShape;
  private pvcFrequency: PvcFrequency;

  /** Current interpolated values. */
  private current: NumericVitals;
  /** Per-vital ramp: target value + rate (units/sec). Absent = at rest. */
  private ramps = new Map<keyof NumericVitals, { target: number; ratePerSec: number }>();
  /** Effects scheduled for a future elapsed time (from afterSec / autoAtSec). */
  private pendingEffects: {
    atSec: number;
    effect: VitalEffect;
    /** Display label for the log; never used as identity. */
    sourceLabel: string;
    /** Owning event id — cancellation and attribution key. Absent for
     *  ad-hoc named effects (applyNamedEffect). */
    eventId?: string;
    /** Queued by the autoAtSec schedule (vs. a manual trigger's afterSec delay). */
    fromAuto?: boolean;
  }[] = [];

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

  /**
   * When false, autoAtSec events are never queued — every event waits for a
   * manual trigger. Defaults to true so the core keeps its authored-timeline
   * semantics; UIs that want the instructor as pacemaker pass false.
   */
  private autoEventsEnabled: boolean;

  constructor(scenario: Scenario, sessionId: string, options?: { autoEvents?: boolean }) {
    this.scenario = scenario;
    this.sessionId = sessionId;
    this.events = [...scenario.events];
    this.autoEventsEnabled = options?.autoEvents ?? true;
    this.phaseId = scenario.phases[0]?.id ?? 'main';
    const { rhythm, capnoShape, pvcFrequency, ...numeric } = scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.pvcFrequency = pvcFrequency ?? 'occasional';
    this.current = { ...numeric };
    // Baselines are authored content: guarantee the pulse-pressure floor here
    // too (this value seeds the first NIBP reading before any tick can pin it).
    this.current.dbp = Math.min(this.current.dbp, maxDbpFor(this.current.sbp));
    this.actions = scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = scenario.monitoring?.artLine ?? false;
    if (this.usesCuff()) {
      this.lastNibp = { sbp: this.current.sbp, dbp: this.current.dbp, atSec: 0 };
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
      // manually while idle — e.g. fired from the events panel during setup).
      if (this.autoEventsEnabled) this.queueAutoEvents();
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

  /**
   * Turn the autoAtSec schedule on or off, mid-session if needed. Turning off
   * cancels queued auto effects; turning on schedules only autos still in the
   * future (past-due unfired events stay manual — no surprise retro-fire).
   * The flag survives reset(): it is an instructor preference, not scenario
   * state.
   */
  setAutoEvents(on: boolean): void {
    if (on === this.autoEventsEnabled) return;
    this.autoEventsEnabled = on;
    if (this.status === 'running' || this.status === 'paused') {
      if (on) {
        this.queueAutoEvents(this.elapsedSec);
      } else {
        // Cancel only autos that have NOT fired yet: an already-fired event's
        // later-staged (afterSec) effects are part of a logged development
        // and must complete regardless of the schedule toggle.
        this.pendingEffects = this.pendingEffects.filter(
          (p) => !p.fromAuto || (p.eventId !== undefined && this.firedEventIds.has(p.eventId)),
        );
      }
    }
    if (this.status !== 'idle') {
      this.addLog('session', `Auto events ${on ? 'on' : 'off'}`);
    }
  }

  getAutoEventsEnabled(): boolean {
    return this.autoEventsEnabled;
  }

  /** Queue effects for unfired autoAtSec events strictly after `afterSec`
   *  (default: all of them — used at start). */
  private queueAutoEvents(afterSec = Number.NEGATIVE_INFINITY): void {
    for (const ev of this.events) {
      if (ev.autoAtSec === undefined || ev.autoAtSec <= afterSec) continue;
      if (this.firedEventIds.has(ev.id)) continue;
      for (const effect of ev.effects) {
        this.pendingEffects.push({
          atSec: ev.autoAtSec + (effect.afterSec ?? 0),
          effect,
          sourceLabel: ev.label,
          eventId: ev.id,
          fromAuto: true,
        });
      }
    }
  }

  /** Reset to baseline (fresh log, fresh actions, elapsed 0). Deliberately
   *  keeps autoEventsEnabled — an instructor preference, not scenario state. */
  reset(): void {
    this.status = 'idle';
    this.elapsedSec = 0;
    this.phaseId = this.scenario.phases[0]?.id ?? 'main';
    this.phaseChangedAtSec = 0;
    const { rhythm, capnoShape, pvcFrequency, ...numeric } = this.scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.pvcFrequency = pvcFrequency ?? 'occasional';
    this.current = { ...numeric };
    this.current.dbp = Math.min(this.current.dbp, maxDbpFor(this.current.sbp));
    this.ramps.clear();
    this.pendingEffects = [];
    this.log = [];
    this.notes = [];
    this.firedEventIds.clear();
    // A fresh run follows author order again; live-added events are kept —
    // they are part of this session's working set until the next load.
    this.pinnedNextEventId = null;
    this.alarmsSilenced = false;
    this.actions = this.scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = this.scenario.monitoring?.artLine ?? false;
    this.lastNibp = this.usesCuff()
      ? { sbp: this.current.sbp, dbp: this.current.dbp, atSec: 0 }
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
      // Auto events log once, via their owning event id, on first effect
      // application (labels are display-only and may not be unique).
      if (p.fromAuto && p.eventId !== undefined && !this.firedEventIds.has(p.eventId)) {
        const autoEvent = this.events.find((e) => e.id === p.eventId);
        if (autoEvent) {
          this.firedEventIds.add(autoEvent.id);
          this.addLog('event', autoEvent.label, 'automatic');
        }
      }
      this.applyEffectNow(p.effect);
    }

    // Ramp numeric vitals toward targets. dbp keeps its ramp until below —
    // the systolic pin can pull it back under a target it already reached.
    for (const [key, ramp] of this.ramps) {
      const cur = this.current[key];
      const step = ramp.ratePerSec * dtSec;
      const next =
        cur < ramp.target ? Math.min(ramp.target, cur + step) : Math.max(ramp.target, cur - step);
      this.current[key] = next;
      if (next === ramp.target && key !== 'dbp') this.ramps.delete(key);
    }
    // Independent per-key ramps can transiently cross even when both
    // endpoints are valid (a fast dbp rise under a slow sbp rise): pin
    // diastolic to the pulse-pressure floor below systolic. A pinned dbp ramp
    // stays alive so diastolic resumes toward its target as systolic climbs.
    const dbpCeil = maxDbpFor(this.current.sbp);
    if (this.current.dbp > dbpCeil) this.current.dbp = dbpCeil;
    const dbpRamp = this.ramps.get('dbp');
    if (dbpRamp && this.current.dbp === dbpRamp.target) this.ramps.delete('dbp');

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
    let clamped = clampVital(key, target);
    // Diastolic must stay a full pulse pressure below systolic: a dbp target
    // is capped at sbp − MIN_PULSE_PRESSURE; lowering sbp drags dbp down with
    // it (the instructor's intent is hypotension, not a block).
    if (key === 'dbp') {
      clamped = Math.min(clamped, maxDbpFor(this.effectiveTarget('sbp')));
    }
    this.startRamp(key, clamped, overSec);
    const meta = VITAL_META[key];
    this.addLog(
      'vital_change',
      `${meta.label} → ${roundVital(key, clamped)}${meta.unit ? ' ' + meta.unit : ''}`,
      overSec > 0 ? `over ${overSec}s` : undefined,
    );
    if (key === 'sbp' && this.effectiveTarget('dbp') > maxDbpFor(clamped)) {
      const dbpTarget = maxDbpFor(clamped);
      this.startRamp('dbp', dbpTarget, overSec);
      this.addLog(
        'vital_change',
        `${VITAL_META.dbp.label} → ${roundVital('dbp', dbpTarget)} ${VITAL_META.dbp.unit}`,
        'pulse pressure kept ≥ 20',
      );
    }
    // The instructor dials end-tidal agent directly (there is no Fi control):
    // inspired agent leads the target — Fi jumps to it while Et ramps, so the
    // monitor shows Fi > Et during wash-in and Fi < Et during wash-out.
    if (key === 'agentEt') {
      this.startRamp('agentFi', clamped, 0);
    }
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

  setPvcFrequency(freq: PvcFrequency): void {
    if (freq === this.pvcFrequency) return;
    this.pvcFrequency = freq;
    this.addLog('vital_change', `PVC frequency → ${PVC_FREQUENCY_LABELS[freq]}`);
  }

  /** Fire a scenario-defined or live-added event by id (faculty trigger). */
  triggerEvent(eventId: string): ScenarioEvent | undefined {
    const ev = this.events.find((e) => e.id === eventId);
    if (!ev) return undefined;
    // Firing an event cancels its own scheduled/staged copies (by id — labels
    // may not be unique) — otherwise queued effects would re-apply at
    // autoAtSec and stomp later adjustments.
    this.pendingEffects = this.pendingEffects.filter((p) => p.eventId !== ev.id);
    this.firedEventIds.add(ev.id);
    this.addLog('event', ev.label, ev.description);
    for (const effect of ev.effects) {
      const delay = effect.afterSec ?? 0;
      if (delay > 0) {
        this.pendingEffects.push({
          atSec: this.elapsedSec + delay,
          effect,
          sourceLabel: ev.label,
          eventId: ev.id,
        });
      } else {
        this.applyEffectNow(effect);
      }
    }
    return ev;
  }

  /** The working event list: authored events plus any added live. */
  getEvents(): readonly ScenarioEvent[] {
    return this.events;
  }

  /**
   * Add an event mid-session (faculty improvisation). The event behaves like
   * any authored event from here on — it renders in the flow, fires via
   * triggerEvent, and lands in the debrief log — but the source scenario is
   * never mutated. Callers must not pass autoAtSec (ad-hoc events are
   * fire-when-ready only); rejects duplicate ids.
   */
  addEvent(event: ScenarioEvent): boolean {
    if (this.events.some((e) => e.id === event.id)) return false;
    // Runtime enforcement of the fire-when-ready contract: the store
    // action's compile-time Omit doesn't bind non-literal callers, and a
    // stray autoAtSec would become schedulable via queueAutoEvents (stray
    // actionIds could break the archived scenario's action references).
    const { autoAtSec: _auto, actionIds: _links, ...clean } = event;
    // Copy-on-write so reference-equality consumers see the change.
    this.events = [...this.events, clean];
    this.addLog('session', `Event added: ${event.label}`);
    return true;
  }

  /**
   * Pin which event "next up" (and the next-event hotkey) points at. Pass
   * null to clear. An unknown id is ignored; a pin on a fired event is left
   * in place but has no effect (nextUnfiredEvent falls back to author order).
   */
  pinNextEvent(eventId: string | null): void {
    if (eventId !== null && !this.events.some((e) => e.id === eventId)) return;
    this.pinnedNextEventId = eventId;
  }

  getPinnedNextEventId(): string | null {
    return this.pinnedNextEventId;
  }

  /**
   * The scenario as actually run: the authored scenario with the working
   * event list (including live-added events). Used by the archive so the
   * debrief's record is self-consistent with firedEventIds.
   */
  getEffectiveScenario(): Scenario {
    return { ...this.scenario, events: [...this.events] };
  }

  /**
   * Apply a named ad-hoc vitals bundle as one logged change. Unlike a series
   * of setVital calls, this writes a single log entry so the bundle reads as
   * one clinical development in the debrief timeline. The effect goes through
   * the same ramp/delay machinery as scenario events. General-purpose engine
   * surface — no production caller in core today; UIs and embedders can build
   * on it.
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
    this.phaseChangedAtSec = this.elapsedSec;
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
    return {
      ...rounded,
      rhythm: this.rhythm,
      capnoShape: this.capnoShape,
      pvcFrequency: this.pvcFrequency,
    };
  }

  /** Archive-only vitals record (not part of broadcast snapshots). */
  getHistory(): VitalsHistorySample[] {
    return [...this.history];
  }

  /** The complete session log. Broadcast snapshots carry only the newest
   *  `SNAPSHOT_LOG_TAIL` entries; the archive substitutes this full record
   *  so the debrief loses nothing. */
  getFullLog(): LogEntry[] {
    return [...this.log];
  }

  snapshot(): SimSnapshot {
    const vitals = this.getVitals();
    // The capnometer needs exhaled breath to sample: at apnea (RR 0) it reads
    // 0, so the numeric EtCO2 tile agrees with the already-flat capnograph.
    // Only the broadcast/alarm value is transformed here — this.current is
    // untouched, so the set value restores the instant the rate recovers, the
    // same measured-vs-true split the NIBP cuff uses for BP below.
    vitals.etco2 = roundVital('etco2', measuredEtco2(vitals.etco2, vitals.rr));
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
      phaseChangedAtSec: Math.floor(this.phaseChangedAtSec),
      vitals,
      nibp: this.lastNibp ? { ...this.lastNibp, atSec: Math.floor(this.lastNibp.atSec) } : null,
      alarms: evaluateAlarms(alarmVitals),
      alarmsSilenced: this.alarmsSilenced,
      actions: this.actions.map((a) => ({ ...a })),
      log: this.log.slice(-SNAPSHOT_LOG_TAIL),
      notes: [...this.notes],
      firedEventIds: [...this.firedEventIds],
      autoEventsEnabled: this.autoEventsEnabled,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private applyEffectNow(effect: VitalEffect): void {
    if (effect.rhythm) this.setRhythm(effect.rhythm);
    if (effect.capnoShape) this.setCapnoShape(effect.capnoShape);
    if (effect.pvcFrequency) this.setPvcFrequency(effect.pvcFrequency);
    if (effect.vitals) {
      for (const key of NUMERIC_VITAL_KEYS) {
        const target = effect.vitals[key];
        if (target !== undefined) this.startRamp(key, clampVital(key, target), effect.overSec ?? 0);
      }
      // Authored effects can't narrow the pulse pressure either: cap the dbp
      // ramp target a full pulse pressure below the effective systolic target.
      const dbpCeil = maxDbpFor(this.effectiveTarget('sbp'));
      if (this.effectiveTarget('dbp') > dbpCeil) {
        this.startRamp('dbp', dbpCeil, effect.overSec ?? 0);
      }
      // Same Fi-leads-Et coupling as setVital, but an authored agentFi wins.
      if (effect.vitals.agentEt !== undefined && effect.vitals.agentFi === undefined) {
        this.startRamp('agentFi', clampVital('agentFi', effect.vitals.agentEt), 0);
      }
    }
  }

  /** Where a vital is headed: its ramp target if ramping, else its value now. */
  private effectiveTarget(key: keyof NumericVitals): number {
    return this.ramps.get(key)?.target ?? this.current[key];
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

/** Session-code format: exactly this many chars from this alphabet. */
const SESSION_CODE_LENGTH = 4;
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no easily-confused chars

/** Generate a short human-readable session code (e.g. "KX3Q"). */
export function generateSessionId(): string {
  let out = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    out += SESSION_CODE_ALPHABET[randomIndex(SESSION_CODE_ALPHABET.length)];
  }
  return out;
}

// Session codes are the only thing gating who can join a session's sync
// channel, so they must come from a CSPRNG (web crypto exists in every
// supported browser and in Node >= 20 — the test environment).
// Rejection-sampled to keep the distribution uniform over a non-power-of-two
// alphabet. Math.random remains only as a last-resort fallback.
function randomIndex(bound: number): number {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues === undefined) {
    return Math.floor(Math.random() * bound);
  }
  const limit = 256 - (256 % bound);
  const buf = new Uint8Array(1);
  for (;;) {
    cryptoObj.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % bound;
  }
}

/**
 * True when `code` is something generateSessionId could have minted — the
 * one validation for codes arriving from outside (URL params), so it can
 * never drift from the generator or from what the student join input
 * accepts.
 */
export function isValidSessionCode(code: string): boolean {
  return (
    code.length === SESSION_CODE_LENGTH &&
    [...code].every((c) => SESSION_CODE_ALPHABET.includes(c))
  );
}
