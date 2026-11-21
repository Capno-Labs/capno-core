import type {
  ActionRecord,
  ActionStatus,
  AlarmLimits,
  AlarmProfile,
  AlarmSide,
  AlarmState,
  AlarmVital,
  AnestheticAgent,
  CapnoShape,
  EcgLead,
  EcgMorphology,
  FacultyNote,
  LogEntry,
  NeuromuscularBlock,
  NibpReading,
  NmbKey,
  NumericVitals,
  Patient,
  PvcFrequency,
  Rhythm,
  Scenario,
  ScenarioEvent,
  SimSnapshot,
  SimStatus,
  TofReading,
  VentKey,
  Ventilation,
  VitalEffect,
  Vitals,
  VitalsHistorySample,
} from './types';
import {
  AGENT_LABELS,
  ALARM_PROFILE_LABELS,
  ALARM_VITALS,
  CAPNO_SHAPE_LABELS,
  FICO2_MAX,
  formatStMm,
  hasPulse,
  NMB_KEYS,
  NMB_META,
  NORMAL_ECG,
  NUMERIC_VITAL_KEYS,
  PVC_FREQUENCY_LABELS,
  QRS_WIDTH_LABELS,
  QT_INTERVAL_LABELS,
  RHYTHM_LABELS,
  ST_FIELD,
  ST_MM_MAX,
  ST_MM_MIN,
  T_WAVE_LABELS,
  UNBLOCKED,
  VENT_KEYS,
  VENT_META,
} from './types';
import {
  clampNmb,
  clampVent,
  clampVital,
  defaultVentilation,
  evaluateAlarms,
  macMultiple,
  maxDbpFor,
  measuredEtco2,
  resolveAlarmLimits,
  steppedAlarmLimit,
  withAlarmLimit,
  roundVital,
  TOF_INTERVAL_SEC,
  tofReading,
  VITAL_META,
} from './vitals';

/** A scenario's starting machine readings: the patient's defaults, with
 *  whatever the baseline states laid over them. */
function baselineVentilation(patient: Patient, stated: Partial<Ventilation> | undefined): Ventilation {
  const vent = defaultVentilation(patient);
  for (const key of VENT_KEYS) {
    const value = stated?.[key];
    if (value !== undefined) vent[key] = clampVent(key, value);
  }
  return vent;
}

/**
 * Fewer than four twitches means there is no fourth to compare, so the ratio
 * is 0 unless stated — and a later recovery climbs from there, not from the
 * 100% of an unblocked patient.
 */
function withRatioFollowingCount(patch: Partial<NeuromuscularBlock>): Partial<NeuromuscularBlock> {
  return patch.tofCount !== undefined && patch.tofCount < 4 && patch.tofRatio === undefined
    ? { ...patch, tofRatio: 0 }
    : patch;
}

/** A scenario's starting neuromuscular block: none, with whatever the
 *  baseline states laid over it. */
function baselineNmb(stated: Partial<NeuromuscularBlock> | undefined): NeuromuscularBlock {
  const nmb = { ...UNBLOCKED };
  const asked = withRatioFollowingCount(stated ?? {});
  for (const key of NMB_KEYS) {
    const value = asked[key];
    if (value !== undefined) nmb[key] = clampNmb(key, value);
  }
  return nmb;
}

/** Presses on the same alarm limit this close together are one adjustment in the log. */
const ALARM_LIMIT_LOG_MERGE_SEC = 5;

/** Who operated the alarm setup: the faculty controller (the default) or a
 *  learner's display. A learner's change says so in the log. */
export type AlarmSetupSource = 'faculty' | 'display';
const LEARNER_DETAIL = 'on a student display';

function clampFico2(value: number): number {
  return Math.min(FICO2_MAX, Math.max(0, value));
}

const ECG_LEADS: readonly EcgLead[] = ['II', 'V5'];
type StField = (typeof ST_FIELD)[EcgLead];
const ST_FIELDS: readonly StField[] = ['stMm', 'stV5Mm'];

/** Rate an escape rhythm is brought to when selected above its range. */
const ESCAPE_RATES: Partial<Record<Rhythm, { above: number; hr: number }>> = {
  junctional: { above: 60, hr: 50 },
  av_block_3: { above: 60, hr: 45 },
  idioventricular: { above: 40, hr: 35 },
};

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
  /** Elapsed time when the capnogram shape last changed (esophageal decay). */
  private capnoShapeSetAtSec = 0;
  /** Inspired CO2, mmHg; ramps like a numeric vital. */
  private fico2 = 0;
  private fico2Ramp: { target: number; ratePerSec: number } | null = null;
  private pvcFrequency: PvcFrequency;
  /** No pulse despite an organized rhythm (PEA, pulseless VT). */
  private pulseless = false;
  /** Anesthesia-machine readings; each ramps like a numeric vital. */
  private vent: Ventilation;
  private ventRamps: Partial<Record<VentKey, { target: number; ratePerSec: number }>> = {};
  /** The monitor shows the machine tiles. Faculty can toggle at runtime. */
  private ventShown: boolean;
  private agent: AnestheticAgent;
  /** Neuromuscular block; each field ramps like a numeric vital. */
  private nmb: NeuromuscularBlock;
  private nmbRamps: Partial<Record<NmbKey, { target: number; ratePerSec: number }>> = {};
  /** The twitch monitor's last measurement; null = no twitch monitor attached. */
  private lastTof: TofReading | null = null;
  /** ECG complex morphology. The ST level ramps like a numeric vital. */
  private ecg: Required<EcgMorphology>;
  private stRamps: Partial<Record<StField, { target: number; ratePerSec: number }>> = {};
  /** The monitor shows a V5 lead under lead II. Faculty can toggle at runtime. */
  private v5Lead: boolean;

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
  /** Alarms silenced with the monitor's Silence key (see alarmKey). */
  private acknowledged = new Set<string>();
  /** The monitor's patient category and the alarm limits in force. */
  private alarmProfile: AlarmProfile;
  private alarmLimits: AlarmLimits;
  /** Vitals whose limit alarms are switched off. */
  private alarmsOff: Set<AlarmVital>;

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

  /**
   * When true, snapshots taken before the scenario starts carry the patient's
   * pre-operative details for the student display. Off unless the instructor
   * turns it on: a scenario's patient block may hold notes written for
   * faculty, and nothing should reach learners that nobody chose to show
   * them. An instructor preference, like autoEventsEnabled.
   */
  private preBriefEnabled: boolean;
  /** Learners may operate the monitor's alarm setup from their display. */
  private learnerAlarmSetup: boolean;

  constructor(
    scenario: Scenario,
    sessionId: string,
    options?: { autoEvents?: boolean; preBrief?: boolean; learnerAlarmSetup?: boolean },
  ) {
    this.scenario = scenario;
    this.sessionId = sessionId;
    this.events = [...scenario.events];
    this.autoEventsEnabled = options?.autoEvents ?? true;
    this.preBriefEnabled = options?.preBrief ?? false;
    this.learnerAlarmSetup = options?.learnerAlarmSetup ?? true;
    this.phaseId = scenario.phases[0]?.id ?? 'main';
    const { rhythm, capnoShape, pvcFrequency, ecg, pulseless, fico2, vent, agent, nmb, ...numeric } =
      scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.fico2 = clampFico2(fico2 ?? 0);
    this.vent = baselineVentilation(scenario.patient, vent);
    this.ventShown = vent !== undefined;
    this.agent = agent ?? 'sevoflurane';
    this.nmb = baselineNmb(nmb);
    this.lastTof = nmb !== undefined ? tofReading(this.nmb, 0) : null;
    this.pvcFrequency = pvcFrequency ?? 'occasional';
    this.ecg = { ...NORMAL_ECG, ...ecg };
    this.pulseless = pulseless ?? false;
    this.current = { ...numeric };
    // Baselines are authored content: guarantee the pulse-pressure floor here
    // too (this value seeds the first NIBP reading before any tick can pin it).
    this.current.dbp = Math.min(this.current.dbp, maxDbpFor(this.current.sbp));
    this.actions = scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = scenario.monitoring?.artLine ?? false;
    this.v5Lead = scenario.monitoring?.v5 ?? false;
    this.alarmProfile = scenario.monitoring?.alarmProfile ?? 'adult';
    this.alarmLimits = resolveAlarmLimits(scenario.monitoring);
    this.alarmsOff = new Set(scenario.monitoring?.alarmsOff);
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

  /** Show or hide the patient pre-brief on student displays before the
   *  scenario starts. Survives reset(), like setAutoEvents. Not logged: it
   *  only matters while idle, before the log begins. */
  setPreBrief(on: boolean): void {
    this.preBriefEnabled = on;
  }

  getPreBriefEnabled(): boolean {
    return this.preBriefEnabled;
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
   *  keeps autoEventsEnabled, preBriefEnabled and learnerAlarmSetup — instructor preferences,
   *  not scenario state. */
  reset(): void {
    this.status = 'idle';
    this.elapsedSec = 0;
    this.phaseId = this.scenario.phases[0]?.id ?? 'main';
    this.phaseChangedAtSec = 0;
    const { rhythm, capnoShape, pvcFrequency, ecg, pulseless, fico2, vent, agent, nmb, ...numeric } =
      this.scenario.baselineVitals;
    this.rhythm = rhythm;
    this.capnoShape = capnoShape ?? 'normal';
    this.capnoShapeSetAtSec = 0;
    this.fico2 = clampFico2(fico2 ?? 0);
    this.fico2Ramp = null;
    this.vent = baselineVentilation(this.scenario.patient, vent);
    this.ventRamps = {};
    this.ventShown = vent !== undefined;
    this.agent = agent ?? 'sevoflurane';
    this.nmb = baselineNmb(nmb);
    this.nmbRamps = {};
    this.lastTof = nmb !== undefined ? tofReading(this.nmb, 0) : null;
    this.pvcFrequency = pvcFrequency ?? 'occasional';
    this.ecg = { ...NORMAL_ECG, ...ecg };
    this.stRamps = {};
    this.pulseless = pulseless ?? false;
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
    this.acknowledged.clear();
    this.actions = this.scenario.expectedActions.map((a) => ({ actionId: a.id, status: 'pending' }));
    this.artLine = this.scenario.monitoring?.artLine ?? false;
    this.v5Lead = this.scenario.monitoring?.v5 ?? false;
    this.alarmProfile = this.scenario.monitoring?.alarmProfile ?? 'adult';
    this.alarmLimits = resolveAlarmLimits(this.scenario.monitoring);
    this.alarmsOff = new Set(this.scenario.monitoring?.alarmsOff);
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

    // The ST level ramps the same way.
    for (const key of VENT_KEYS) {
      const ramp = this.ventRamps[key];
      if (!ramp) continue;
      const step = ramp.ratePerSec * dtSec;
      const cur = this.vent[key];
      const next = cur < ramp.target ? Math.min(ramp.target, cur + step) : Math.max(ramp.target, cur - step);
      this.vent[key] = next;
      if (next === ramp.target) delete this.ventRamps[key];
    }
    for (const key of NMB_KEYS) {
      const ramp = this.nmbRamps[key];
      if (!ramp) continue;
      const step = ramp.ratePerSec * dtSec;
      const cur = this.nmb[key];
      const next = cur < ramp.target ? Math.min(ramp.target, cur + step) : Math.max(ramp.target, cur - step);
      this.nmb[key] = next;
      if (next === ramp.target) delete this.nmbRamps[key];
    }
    if (this.fico2Ramp) {
      const { target, ratePerSec } = this.fico2Ramp;
      const step = ratePerSec * dtSec;
      this.fico2 = this.fico2 < target ? Math.min(target, this.fico2 + step) : Math.max(target, this.fico2 - step);
      if (this.fico2 === target) this.fico2Ramp = null;
    }
    for (const field of ST_FIELDS) {
      const ramp = this.stRamps[field];
      if (!ramp) continue;
      const step = ramp.ratePerSec * dtSec;
      const cur = this.ecg[field];
      const next = cur < ramp.target ? Math.min(ramp.target, cur + step) : Math.max(ramp.target, cur - step);
      this.ecg[field] = next;
      if (next === ramp.target) delete this.stRamps[field];
    }

    // Automatic NIBP cuff cycle.
    if (this.lastNibp && this.elapsedSec - this.lastNibp.atSec >= this.nibpIntervalSec()) {
      this.cycleNibp();
    }

    // Automatic twitch-monitor measurement.
    if (this.lastTof && this.elapsedSec - this.lastTof.atSec >= TOF_INTERVAL_SEC) {
      this.measureTof();
    }

    // Vitals history sample every 10 s (archive-only; not broadcast).
    if (this.elapsedSec - this.lastHistorySec >= HISTORY_SAMPLE_SEC) {
      this.recordHistorySample();
    }
  }

  /** Take an NIBP reading now (automatic interval or faculty "cycle cuff"). */
  cycleNibp(): void {
    if (!this.usesCuff()) return;
    // An oscillometric cuff measures the pulse it feels: with none, the cycle
    // fails whatever pressure the scenario holds. Recorded as 0/0, which the
    // monitor shows as a failed reading.
    if (!hasPulse({ rhythm: this.rhythm, pulseless: this.pulseless })) {
      this.lastNibp = { sbp: 0, dbp: 0, atSec: this.elapsedSec };
      this.addLog('vital_change', 'NIBP — no reading', 'cuff cycle, no pulse');
      return;
    }
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

  /** `impliedHr: false` skips the brady/tach rate coupling — used when the
   *  caller supplies its own HR target in the same step (authored effects). */
  setRhythm(rhythm: Rhythm, impliedHr = true): void {
    if (rhythm === this.rhythm) return;
    this.rhythm = rhythm;
    this.addLog('vital_change', `Rhythm → ${RHYTHM_LABELS[rhythm]}`);
    // Sinus brady/tach imply a rate range (<60 / >100). Bring HR into range
    // once on selection; the instructor stays free to re-dial HR afterwards.
    if (!impliedHr) return;
    if (rhythm === 'sinus_brady' && this.effectiveTarget('hr') >= 60) {
      this.startRamp('hr', 50, 5);
      this.addLog('vital_change', 'HR → 50 bpm', 'sinus bradycardia');
    } else if (rhythm === 'sinus_tach' && this.effectiveTarget('hr') <= 100) {
      this.startRamp('hr', 110, 5);
      this.addLog('vital_change', 'HR → 110 bpm', 'sinus tachycardia');
    } else {
      // Escape rhythms are slow by definition: bring a faster rate into the
      // published range once, on selection (junctional escape 40–60/min,
      // complete block with a junctional escape likewise, idioventricular
      // under 40/min — StatPearls NBK507715, NBK545199, NBK554520).
      const escape = ESCAPE_RATES[rhythm];
      if (escape && this.effectiveTarget('hr') > escape.above) {
        this.startRamp('hr', escape.hr, 5);
        this.addLog('vital_change', `HR → ${escape.hr} bpm`, RHYTHM_LABELS[rhythm].toLowerCase());
      }
    }
  }

  setCapnoShape(shape: CapnoShape): void {
    if (shape === this.capnoShape) return;
    this.capnoShape = shape;
    this.capnoShapeSetAtSec = this.elapsedSec;
    this.addLog('vital_change', `CO₂ waveform → ${CAPNO_SHAPE_LABELS[shape]}`);
  }

  /** Set the inspired CO2 (rebreathing), ramping over `overSec` seconds. */
  setFico2(target: number, overSec = 0): void {
    const clamped = clampFico2(target);
    if (clamped === this.getFico2Target()) return;
    const distance = Math.abs(clamped - this.fico2);
    if (overSec <= 0 || distance === 0) {
      this.fico2Ramp = null;
      this.fico2 = clamped;
    } else {
      this.fico2Ramp = { target: clamped, ratePerSec: distance / overSec };
    }
    this.addLog(
      'vital_change',
      `FiCO₂ → ${clamped} mmHg`,
      overSec > 0 ? `over ${overSec}s` : undefined,
    );
  }

  /**
   * Set anesthesia-machine readings. Only the fields in `patch` change; each
   * ramps to its target over `overSec` seconds (0 = instant).
   */
  setVent(patch: Partial<Ventilation>, overSec = 0): void {
    for (const key of VENT_KEYS) {
      const asked = patch[key];
      if (asked === undefined) continue;
      const target = clampVent(key, asked);
      if (target === this.getVentTarget(key)) continue;
      const distance = Math.abs(target - this.vent[key]);
      if (overSec <= 0 || distance === 0) {
        delete this.ventRamps[key];
        this.vent[key] = target;
      } else {
        this.ventRamps[key] = { target, ratePerSec: distance / overSec };
      }
      const meta = VENT_META[key];
      this.addLog(
        'vital_change',
        `${meta.label} → ${target} ${meta.unit}`,
        overSec > 0 ? `over ${overSec}s` : undefined,
      );
    }
  }

  /** Where a machine reading is headed: its ramp target if ramping, else its value now. */
  getVentTarget(key: VentKey): number {
    return this.ventRamps[key]?.target ?? this.vent[key];
  }

  /** Show or hide the anesthesia-machine tiles on the monitor (faculty toggle). */
  setVentShown(on: boolean): void {
    if (on === this.ventShown) return;
    this.ventShown = on;
    this.addLog('vital_change', on ? 'Machine readings shown' : 'Machine readings hidden');
  }

  getVentShown(): boolean {
    return this.ventShown;
  }

  /** Switch the volatile agent. The concentrations stay as they are. */
  setAgent(agent: AnestheticAgent): void {
    if (agent === this.agent) return;
    this.agent = agent;
    this.addLog('vital_change', `Agent → ${AGENT_LABELS[agent]}`);
  }

  /**
   * Set the neuromuscular block. Only the fields in `patch` change; each ramps
   * to its target over `overSec` seconds (0 = instant). The monitor shows the
   * change at its next measurement, not at once. Taking the count below four
   * takes the ratio to 0 with it — there is no fourth twitch to compare —
   * unless the patch says otherwise.
   */
  setNmb(patch: Partial<NeuromuscularBlock>, overSec = 0): void {
    const asked = withRatioFollowingCount(patch);
    for (const key of NMB_KEYS) {
      const value = asked[key];
      if (value === undefined) continue;
      const target = clampNmb(key, value);
      if (target === this.getNmbTarget(key)) continue;
      const distance = Math.abs(target - this.nmb[key]);
      if (overSec <= 0 || distance === 0) {
        delete this.nmbRamps[key];
        this.nmb[key] = target;
      } else {
        this.nmbRamps[key] = { target, ratePerSec: distance / overSec };
      }
      // The ratio following the count down is not a separate decision.
      if (patch[key] === undefined) continue;
      const meta = NMB_META[key];
      this.addLog(
        'vital_change',
        `${meta.label} → ${target}${key === 'tofRatio' ? '%' : ''}`,
        overSec > 0 ? `over ${overSec}s` : undefined,
      );
    }
  }

  /** Where a block field is headed: its ramp target if ramping, else its value now. */
  getNmbTarget(key: NmbKey): number {
    return this.nmbRamps[key]?.target ?? this.nmb[key];
  }

  /** Attach or remove the twitch monitor (faculty toggle). Attaching measures at once. */
  setTofAttached(on: boolean): void {
    if (on === (this.lastTof !== null)) return;
    if (on) {
      this.addLog('vital_change', 'Twitch monitor attached');
      this.measureTof();
    } else {
      this.lastTof = null;
      this.addLog('vital_change', 'Twitch monitor removed');
    }
  }

  getTofAttached(): boolean {
    return this.lastTof !== null;
  }

  /** Stimulate now (automatic interval or faculty "stimulate"). Logged only
   *  when the reading differs from the last one — the monitor repeats every
   *  few seconds. */
  measureTof(): void {
    const prev = this.lastTof;
    const next = tofReading(this.nmb, this.elapsedSec);
    this.lastTof = next;
    if (prev && prev.count === next.count && prev.ratio === next.ratio && prev.ptc === next.ptc) return;
    const text =
      next.ratio !== null
        ? `TOF ${next.ratio}%`
        : next.ptc !== null
          ? `TOF count 0, PTC ${next.ptc}`
          : `TOF count ${next.count}`;
    this.addLog('vital_change', text, 'twitch monitor');
  }

  /** Where the inspired CO2 is headed: its ramp target if ramping, else its value now. */
  getFico2Target(): number {
    return this.fico2Ramp?.target ?? this.fico2;
  }

  setPvcFrequency(freq: PvcFrequency): void {
    if (freq === this.pvcFrequency) return;
    this.pvcFrequency = freq;
    this.addLog('vital_change', `PVC frequency → ${PVC_FREQUENCY_LABELS[freq]}`);
  }

  /**
   * Take the pulse away or give it back, whatever the rhythm: PEA is an
   * organized rhythm with no pulse, and VT may or may not have one. Not tied
   * to the rhythm buttons — changing rhythm leaves it as set. (VF, torsades,
   * asystole and the legacy `pea` rhythm never have a pulse regardless.)
   */
  setPulseless(on: boolean): void {
    if (on === this.pulseless) return;
    this.pulseless = on;
    this.addLog('vital_change', `Pulse → ${on ? 'absent' : 'present'}`);
  }

  /** Where a lead's ST level is headed: its ramp target if ramping, else its value now. */
  getStTarget(lead: EcgLead = 'II'): number {
    const field = ST_FIELD[lead];
    return this.stRamps[field]?.target ?? this.ecg[field];
  }

  /**
   * Switch the monitor's patient category (faculty). The scenario's own
   * profile comes back with the scenario's changes to it; any other profile
   * is taken as it stands, since changes written for one category need not
   * make sense on another.
   */
  setAlarmProfile(profile: AlarmProfile): void {
    if (profile === this.alarmProfile) return;
    const authored = this.scenario.monitoring?.alarmProfile ?? 'adult';
    this.alarmProfile = profile;
    this.alarmLimits = resolveAlarmLimits(
      profile === authored ? this.scenario.monitoring : { alarmProfile: profile },
    );
    this.addLog('vital_change', `Alarm limits → ${ALARM_PROFILE_LABELS[profile]}`);
  }

  getAlarmProfile(): AlarmProfile {
    return this.alarmProfile;
  }

  /**
   * Set one vital's low or high alarm limit, as on the monitor's alarm
   * setup: `null`, or the end of the vital's range, switches that limit off;
   * a critical limit the new limit passes moves with it.
   */
  setAlarmLimit(vital: AlarmVital, side: AlarmSide, value: number | null, by?: AlarmSetupSource): void {
    const key = side === 'low' ? 'warnLow' : 'warnHigh';
    const before = this.alarmLimits[vital][key];
    this.alarmLimits = withAlarmLimit(this.alarmLimits, vital, side, value);
    const after = this.alarmLimits[vital][key];
    if (after === before) return;
    // One limit is usually reached with several presses: keep the log to
    // where it ended up, not every step on the way.
    const prefix = `${VITAL_META[vital].label} ${side} alarm limit → `;
    const last = this.log.at(-1);
    const t = Math.floor(this.elapsedSec);
    const detail = by === 'display' ? LEARNER_DETAIL : undefined;
    if (
      last &&
      last.kind === 'vital_change' &&
      last.label.startsWith(prefix) &&
      last.detail === detail &&
      t - last.t <= ALARM_LIMIT_LOG_MERGE_SEC
    ) {
      this.log[this.log.length - 1] = { ...last, t, label: `${prefix}${after ?? 'off'}` };
      return;
    }
    this.addLog('vital_change', `${prefix}${after ?? 'off'}`, detail);
  }

  /** One press of − or + on a limit in the alarm setup. */
  stepAlarmLimit(vital: AlarmVital, side: AlarmSide, direction: -1 | 1, by?: AlarmSetupSource): void {
    this.setAlarmLimit(vital, side, steppedAlarmLimit(this.alarmLimits, vital, side, direction), by);
  }

  /** Switch one vital's limit alarms off or back on. */
  setAlarmOff(vital: AlarmVital, off: boolean, by?: AlarmSetupSource): void {
    if (off === this.alarmsOff.has(vital)) return;
    if (off) this.alarmsOff.add(vital);
    else this.alarmsOff.delete(vital);
    this.addLog(
      'vital_change',
      `${VITAL_META[vital].label} alarms ${off ? 'off' : 'on'}`,
      by === 'display' ? LEARNER_DETAIL : undefined,
    );
  }

  /** Let learners operate the alarm setup from their display, or not. */
  setLearnerAlarmSetup(on: boolean): void {
    if (on === this.learnerAlarmSetup) return;
    this.learnerAlarmSetup = on;
    if (this.status !== 'idle') {
      this.addLog('session', `Learner alarm setup ${on ? 'on' : 'off'}`);
    }
  }

  getLearnerAlarmSetup(): boolean {
    return this.learnerAlarmSetup;
  }

  /** Add or remove the V5 lead on the monitor at runtime (faculty toggle). */
  setV5Lead(on: boolean): void {
    if (on === this.v5Lead) return;
    this.v5Lead = on;
    this.addLog('vital_change', on ? 'V5 lead added' : 'V5 lead removed');
  }

  /**
   * Change the ECG morphology. Only the fields present in `patch` change.
   * The ST level ramps to its target over `overSec` seconds (0 = instant);
   * T wave, QRS width and QT switch immediately, like a rhythm.
   */
  setEcg(patch: EcgMorphology, overSec = 0): void {
    for (const lead of ECG_LEADS) {
      const field = ST_FIELD[lead];
      const asked = patch[field];
      if (asked === undefined) continue;
      const target = Math.min(ST_MM_MAX, Math.max(ST_MM_MIN, asked));
      if (target === this.getStTarget(lead)) continue;
      const distance = Math.abs(target - this.ecg[field]);
      if (overSec <= 0 || distance === 0) {
        delete this.stRamps[field];
        this.ecg[field] = target;
      } else {
        this.stRamps[field] = { target, ratePerSec: distance / overSec };
      }
      this.addLog(
        'vital_change',
        `ST ${lead} → ${formatStMm(target)} mm`,
        overSec > 0 ? `over ${overSec}s` : undefined,
      );
    }
    if (patch.tWave !== undefined && patch.tWave !== this.ecg.tWave) {
      this.ecg.tWave = patch.tWave;
      this.addLog('vital_change', `T wave → ${T_WAVE_LABELS[patch.tWave]}`);
    }
    if (patch.qrs !== undefined && patch.qrs !== this.ecg.qrs) {
      this.ecg.qrs = patch.qrs;
      this.addLog('vital_change', `QRS → ${QRS_WIDTH_LABELS[patch.qrs]}`);
    }
    if (patch.qt !== undefined && patch.qt !== this.ecg.qt) {
      this.ecg.qt = patch.qt;
      this.addLog('vital_change', `QT → ${QT_INTERVAL_LABELS[patch.qt]}`);
    }
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
      fico2: Math.round(this.fico2 * 10) / 10,
      pvcFrequency: this.pvcFrequency,
      ...(this.ventShown ? { vent: this.shownVent() } : {}),
      ...(this.lastTof
        ? {
            nmb: {
              tofCount: Math.round(this.nmb.tofCount),
              tofRatio: Math.round(this.nmb.tofRatio),
              ptc: Math.round(this.nmb.ptc),
            },
          }
        : {}),
      agent: this.agent,
      ecg: {
        ...this.ecg,
        stMm: Math.round(this.ecg.stMm * 10) / 10,
        stV5Mm: Math.round(this.ecg.stV5Mm * 10) / 10,
      },
      pulseless: this.pulseless,
    };
  }

  /**
   * The machine readings as displayed: rounded, and kept in their physical
   * order — plateau pressure cannot exceed peak, nor PEEP the plateau — even
   * while independent ramps would briefly cross.
   */
  private shownVent(): Ventilation {
    const pip = Math.round(this.vent.pip);
    const pplat = Math.min(Math.round(this.vent.pplat), pip);
    const peep = Math.min(Math.round(this.vent.peep), pplat);
    return {
      fio2: Math.round(this.vent.fio2),
      pip,
      pplat,
      peep,
      vt: Math.round(this.vent.vt),
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

  /**
   * The vitals as the monitor measures them, and the ones alarms are judged
   * on (in cuff mode, the last cuff reading rather than the true pressure).
   */
  private measured(): { vitals: Vitals; alarmVitals: Vitals } {
    const vitals = this.getVitals();
    // The capnometer needs exhaled breath to sample: at apnea (RR 0) it reads
    // 0, so the numeric EtCO2 tile agrees with the already-flat capnograph.
    // Only the broadcast/alarm value is transformed here — this.current is
    // untouched, so the set value restores the instant the rate recovers, the
    // same measured-vs-true split the NIBP cuff uses for BP below.
    // Likewise a tube in the esophagus: what little CO2 it carries dies away
    // breath by breath from the moment that shape is set.
    const esophagealBreaths =
      this.capnoShape === 'esophageal'
        ? ((this.elapsedSec - this.capnoShapeSetAtSec) * vitals.rr) / 60
        : undefined;
    vitals.etco2 = roundVital('etco2', measuredEtco2(vitals.etco2, vitals.rr, esophagealBreaths));
    // In cuff mode, BP alarms judge the last *measured* reading — an alarm
    // must not reveal a pressure the monitor has not yet measured.
    const alarmVitals = this.lastNibp
      ? { ...vitals, sbp: this.lastNibp.sbp, dbp: this.lastNibp.dbp }
      : vitals;
    return { vitals, alarmVitals };
  }

  /**
   * What makes two alarms "the same alarm" for Silence: the vital, the
   * priority and the kind of alarm, not the number in its message — so a
   * heart rate drifting from 128 to 131 stays silenced, while a warning that
   * becomes critical, or a different rhythm, is a new alarm. A cuff pressure
   * is an intermittent measurement: each reading alarms afresh.
   */
  private alarmKey(alarm: AlarmState): string {
    const key = `${alarm.vital}:${alarm.level}:${alarm.message.replace(/[\d.]+/g, '')}`;
    return alarm.vital === 'sbp' && this.lastNibp ? `${key}@${this.lastNibp.atSec}` : key;
  }

  /**
   * The alarms active now, each marked if it has been silenced. An
   * acknowledgement lasts only while its alarm does: once the cause clears
   * the alarm is reset, and its return sounds again.
   */
  private alarmsNow(alarmVitals: Vitals): AlarmState[] {
    const alarms = evaluateAlarms(alarmVitals, this.alarmLimits, [...this.alarmsOff]);
    const active = new Set(alarms.map((a) => this.alarmKey(a)));
    for (const key of this.acknowledged) {
      if (!active.has(key)) this.acknowledged.delete(key);
    }
    return alarms.map((a) => (this.acknowledged.has(this.alarmKey(a)) ? { ...a, acknowledged: true } : a));
  }

  /**
   * The monitor's Silence key: acknowledge every alarm active now. They stop
   * sounding and flashing but stay listed; a new alarm — another vital, a
   * higher priority, or the same one returning after it cleared — sounds as
   * usual. Nothing to silence is a no-op.
   */
  acknowledgeAlarms(by?: AlarmSetupSource): void {
    const pending = this.alarmsNow(this.measured().alarmVitals).filter((a) => !a.acknowledged);
    if (pending.length === 0) return;
    for (const alarm of pending) this.acknowledged.add(this.alarmKey(alarm));
    this.addLog(
      'vital_change',
      `Alarms silenced: ${pending.map((a) => a.message).join(', ')}`,
      by === 'display' ? LEARNER_DETAIL : undefined,
    );
  }

  snapshot(): SimSnapshot {
    const { vitals, alarmVitals } = this.measured();
    return {
      scenarioId: this.scenario.id,
      sessionId: this.sessionId,
      status: this.status,
      elapsedSec: Math.floor(this.elapsedSec),
      phaseId: this.phaseId,
      phaseChangedAtSec: Math.floor(this.phaseChangedAtSec),
      vitals,
      nibp: this.lastNibp ? { ...this.lastNibp, atSec: Math.floor(this.lastNibp.atSec) } : null,
      v5Lead: this.v5Lead,
      ...(this.lastTof ? { tof: { ...this.lastTof, atSec: Math.floor(this.lastTof.atSec) } } : {}),
      gas: {
        agent: this.agent,
        mac: Math.round(macMultiple(this.agent, vitals.agentEt, this.scenario.patient.age) * 100) / 100,
      },
      alarms: this.alarmsNow(alarmVitals),
      alarmsSilenced: this.alarmsSilenced,
      alarmLimits: this.alarmLimits,
      alarmProfile: this.alarmProfile,
      alarmsOff: ALARM_VITALS.filter((v) => this.alarmsOff.has(v)),
      learnerAlarmSetup: this.learnerAlarmSetup,
      actions: this.actions.map((a) => ({ ...a })),
      log: this.log.slice(-SNAPSHOT_LOG_TAIL),
      notes: [...this.notes],
      firedEventIds: [...this.firedEventIds],
      // Pre-brief only before the start: once the scenario runs, the display
      // is the monitor and the broadcast carries nothing extra.
      ...(this.status === 'idle' && this.preBriefEnabled
        ? { preBrief: { patient: this.scenario.patient } }
        : {}),
      autoEventsEnabled: this.autoEventsEnabled,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private applyEffectNow(effect: VitalEffect): void {
    if (effect.rhythm) this.setRhythm(effect.rhythm, effect.vitals?.hr === undefined);
    if (effect.capnoShape) this.setCapnoShape(effect.capnoShape);
    if (effect.fico2 !== undefined) this.setFico2(effect.fico2, effect.overSec ?? 0);
    if (effect.pvcFrequency) this.setPvcFrequency(effect.pvcFrequency);
    if (effect.ecg) this.setEcg(effect.ecg, effect.overSec ?? 0);
    if (effect.pulseless !== undefined) this.setPulseless(effect.pulseless);
    if (effect.vent) this.setVent(effect.vent, effect.overSec ?? 0);
    if (effect.nmb) this.setNmb(effect.nmb, effect.overSec ?? 0);
    if (effect.agent) this.setAgent(effect.agent);
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
