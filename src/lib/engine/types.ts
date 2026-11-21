/**
 * Capno scenario engine — core types.
 *
 * This module is framework-free (no React/Next imports) so the engine can be
 * reused in other runtimes (CLI regression tests, a future native app, or a
 * server-authoritative session host).
 */

// ── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'student' | 'faculty' | 'admin';

// ── Vital signs ──────────────────────────────────────────────────────────────

export type Rhythm =
  | 'sinus'
  | 'sinus_brady'
  | 'sinus_tach'
  | 'pvc'
  | 'pac'
  | 'afib'
  | 'svt'
  | 'vtach'
  | 'vfib'
  | 'pea'
  | 'asystole'
  | 'av_block_1'
  | 'av_block_mobitz1'
  | 'av_block_mobitz2'
  | 'av_block_3'
  | 'junctional'
  | 'aflutter'
  | 'torsades'
  | 'paced'
  | 'idioventricular';

export const RHYTHM_LABELS: Record<Rhythm, string> = {
  sinus: 'Sinus Rhythm',
  sinus_brady: 'Sinus Bradycardia',
  sinus_tach: 'Sinus Tachycardia',
  pvc: 'Sinus with PVCs',
  pac: 'Sinus with PACs',
  afib: 'Atrial Fibrillation',
  svt: 'SVT',
  vtach: 'Ventricular Tachycardia',
  vfib: 'Ventricular Fibrillation',
  pea: 'PEA',
  asystole: 'Asystole',
  av_block_1: 'First-degree AV Block',
  av_block_mobitz1: 'AV Block — Mobitz I',
  av_block_mobitz2: 'AV Block — Mobitz II',
  av_block_3: 'Complete Heart Block',
  junctional: 'Junctional Rhythm',
  aflutter: 'Atrial Flutter',
  torsades: 'Torsades de Pointes',
  paced: 'Ventricular Paced',
  idioventricular: 'Idioventricular Rhythm',
};

/**
 * Rhythms with no ventricular ejection at all — the patient is pulseless
 * whatever the `pulseless` flag says. (`pea` is the legacy wide-complex PEA
 * rhythm; PEA with any other organized rhythm is that rhythm plus
 * `pulseless: true`.)
 */
const NON_PERFUSING_RHYTHMS: ReadonlySet<Rhythm> = new Set(['vfib', 'pea', 'asystole', 'torsades']);

/** Whether the rhythm can produce a pulse at all. */
export function rhythmPerfuses(rhythm: Rhythm): boolean {
  return !NON_PERFUSING_RHYTHMS.has(rhythm);
}

/**
 * Whether the patient has a pulse: the rhythm can perfuse, and the pulse has
 * not been taken away (PEA, pulseless VT). Everything pulse-dependent on the
 * monitor — pleth, arterial trace, SpO₂, the pulse tone, a cuff reading —
 * follows this, not the rhythm alone.
 */
export function hasPulse(vitals: Pick<Vitals, 'rhythm' | 'pulseless'>): boolean {
  return rhythmPerfuses(vitals.rhythm) && !vitals.pulseless;
}

/**
 * Capnograph trace morphology. `normal` is the square expiratory plateau;
 * `bronchospasm` is the slurred, upsloping "shark fin" of obstructed
 * expiration; `curare_cleft` is a normal plateau interrupted by a transient
 * notch — spontaneous respiratory effort during partial neuromuscular
 * blockade; `cardiogenic` adds heartbeat-synchronous ripples to the end of
 * expiration; `leak` is a plateau that sags early (cuff or circuit leak).
 * Those are display-only: the EtCO2 number is unaffected.
 *
 * `esophageal` is different: the tube is in the esophagus, so the measured
 * CO2 itself dies away over the first few breaths — the engine lowers the
 * EtCO2 number the monitor reports (see measuredEtco2), and the trace with it.
 *
 * Rebreathing is not a shape: it is an inspired CO2 above zero (`fico2`),
 * which raises the trace's baseline.
 */
export type CapnoShape =
  | 'normal'
  | 'bronchospasm'
  | 'curare_cleft'
  | 'cardiogenic'
  | 'leak'
  | 'esophageal';

export const CAPNO_SHAPE_LABELS: Record<CapnoShape, string> = {
  normal: 'Normal',
  bronchospasm: 'Bronchospasm (shark fin)',
  curare_cleft: 'Curare cleft',
  cardiogenic: 'Cardiogenic oscillations',
  leak: 'Cuff / circuit leak',
  esophageal: 'Esophageal intubation',
};

// ── Anesthesia machine ───────────────────────────────────────────────────────

/** The volatile agent in use. Absent on vitals = sevoflurane. */
export type AnestheticAgent = 'sevoflurane' | 'isoflurane' | 'desflurane';

export const AGENT_LABELS: Record<AnestheticAgent, string> = {
  sevoflurane: 'Sevoflurane',
  isoflurane: 'Isoflurane',
  desflurane: 'Desflurane',
};

/** Three-letter tags, as an agent analyzer prints them. */
export const AGENT_TAGS: Record<AnestheticAgent, string> = {
  sevoflurane: 'SEV',
  isoflurane: 'ISO',
  desflurane: 'DES',
};

/**
 * Ventilator and gas readings from the anesthesia machine. Like the vitals,
 * these are authored or instructor-set targets, not a lung model: a scenario
 * says what the machine reads (a peak pressure of 45 in bronchospasm, a tidal
 * volume of 0 after a disconnection) and the monitor shows it.
 */
export interface Ventilation {
  /** Inspired oxygen, %. */
  fio2: number;
  /** Peak inspiratory pressure, cmH2O. */
  pip: number;
  /** Plateau (end-inspiratory pause) pressure, cmH2O. */
  pplat: number;
  /** Positive end-expiratory pressure, cmH2O. */
  peep: number;
  /** Exhaled tidal volume, mL. */
  vt: number;
}

export const VENT_KEYS = ['fio2', 'pip', 'pplat', 'peep', 'vt'] as const satisfies readonly (keyof Ventilation)[];
export type VentKey = (typeof VENT_KEYS)[number];

export interface VentMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export const VENT_META: Record<VentKey, VentMeta> = {
  // Down to 0, not 21: a pipeline crossover delivers a hypoxic mixture.
  fio2: { label: 'FiO₂', unit: '%', min: 0, max: 100, step: 5 },
  pip: { label: 'PIP', unit: 'cmH₂O', min: 0, max: 80, step: 1 },
  pplat: { label: 'Pplat', unit: 'cmH₂O', min: 0, max: 60, step: 1 },
  peep: { label: 'PEEP', unit: 'cmH₂O', min: 0, max: 25, step: 1 },
  vt: { label: 'VT', unit: 'mL', min: 0, max: 1500, step: 25 },
};

/** Minute ventilation, L/min, from exhaled tidal volume and respiratory rate. */
export function minuteVentilation(vtMl: number, rr: number): number {
  return (vtMl * rr) / 1000;
}

/** Highest inspired CO2 the sim will hold, mmHg. Reported cases of a stuck
 *  expiratory valve reach 30 (Lee et al., Korean J Anesthesiol 2013;65:337). */
export const FICO2_MAX = 30;

/**
 * How often an ectopic complex replaces a sinus beat when the rhythm is
 * `pvc`. Named after the classic coupling patterns; display-only (the HR
 * number is unaffected). Absent = 'occasional'.
 */
export type PvcFrequency = 'rare' | 'occasional' | 'trigeminy' | 'bigeminy';

export const PVC_FREQUENCY_LABELS: Record<PvcFrequency, string> = {
  rare: 'Rare (1:8)',
  occasional: 'Occasional (1:4)',
  trigeminy: 'Trigeminy (1:3)',
  bigeminy: 'Bigeminy (1:2)',
};

/** One PVC every N beats, per frequency level. */
export const PVC_FREQUENCY_EVERY_N: Record<PvcFrequency, number> = {
  rare: 8,
  occasional: 4,
  trigeminy: 3,
  bigeminy: 2,
};

/**
 * ECG morphology — how each complex is drawn, independent of the rhythm.
 * Applies to beats with a normal conduction pattern (the sinus rhythms, AF,
 * SVT, PACs and the normal beats between PVCs); wide ectopic complexes, VT,
 * VF, PEA and asystole are drawn as before.
 *
 * Display-only: none of it changes HR, pressures or alarms. Every field is
 * optional; absent = normal.
 */
export type TWave = 'normal' | 'peaked' | 'flat' | 'inverted';
export type QrsWidth = 'normal' | 'wide';
export type QtInterval = 'normal' | 'long';

export interface EcgMorphology {
  /**
   * ST-segment deviation in lead II, in millimetres at standard gain
   * (1 mm = 0.1 mV): negative = depression, positive = elevation. −5 to +5.
   * The one field that ramps — it follows the effect's `overSec`.
   */
  stMm?: number;
  /**
   * ST-segment deviation in lead V5, same units and range. Independent of
   * lead II: ischemia often shows in one lead and not the other. Drawn only
   * when the monitor has a V5 lead (see MonitoringConfig.v5).
   */
  stV5Mm?: number;
  tWave?: TWave;
  qrs?: QrsWidth;
  qt?: QtInterval;
}

export const ST_MM_MIN = -5;
export const ST_MM_MAX = 5;

export const T_WAVE_LABELS: Record<TWave, string> = {
  normal: 'Normal',
  peaked: 'Peaked',
  flat: 'Flattened',
  inverted: 'Inverted',
};

export const QRS_WIDTH_LABELS: Record<QrsWidth, string> = {
  normal: 'Narrow',
  wide: 'Wide',
};

export const QT_INTERVAL_LABELS: Record<QtInterval, string> = {
  normal: 'Normal',
  long: 'Prolonged',
};

const MORPHOLOGY_RHYTHMS: ReadonlySet<Rhythm> = new Set([
  'sinus',
  'sinus_brady',
  'sinus_tach',
  'pvc',
  'pac',
  'afib',
  'svt',
  'av_block_1',
  'av_block_mobitz1',
  'av_block_mobitz2',
  'av_block_3',
  'junctional',
]);

/**
 * Whether the rhythm has normal-pattern complexes that ECG morphology
 * reshapes and an ST level can be read from — not VT, VF, torsades, PEA,
 * asystole, flutter, or the wide paced and idioventricular complexes.
 */
export function ecgMorphologyApplies(rhythm: Rhythm): boolean {
  return MORPHOLOGY_RHYTHMS.has(rhythm);
}

/** The ECG leads the monitor can show, and the ST field each one reads. */
export type EcgLead = 'II' | 'V5';
export const ST_FIELD: Record<EcgLead, 'stMm' | 'stV5Mm'> = { II: 'stMm', V5: 'stV5Mm' };

/** Every field at its default — a normal complex. */
export const NORMAL_ECG: Required<EcgMorphology> = {
  stMm: 0,
  stV5Mm: 0,
  tWave: 'normal',
  qrs: 'normal',
  qt: 'normal',
};

/** "−2.0", "+1.5", "0.0" — signed, one decimal, as monitors print ST. */
export function formatStMm(stMm: number): string {
  const rounded = Math.round(stMm * 10) / 10;
  if (rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}

/** Numeric (continuously interpolated) vital signs. */
export interface NumericVitals {
  /** Heart rate, beats/min */
  hr: number;
  /** Systolic blood pressure, mmHg */
  sbp: number;
  /** Diastolic blood pressure, mmHg */
  dbp: number;
  /** Pulse oximetry, % */
  spo2: number;
  /** End-tidal CO2, mmHg */
  etco2: number;
  /** Respiratory rate, breaths/min */
  rr: number;
  /** Core temperature, °C */
  temp: number;
  /**
   * Anesthetic depth index, 0–100 (displayed like a processed-EEG index:
   * 40–60 = surgical anesthesia, >80 = awake).
   */
  depth: number;
  /** Expired volatile agent concentration, % (displayed as sevoflurane/SEV). */
  agentEt: number;
  /** Inspired volatile agent concentration, %. */
  agentFi: number;
}

export const NUMERIC_VITAL_KEYS = [
  'hr',
  'sbp',
  'dbp',
  'spo2',
  'etco2',
  'rr',
  'temp',
  'depth',
  'agentEt',
  'agentFi',
] as const satisfies readonly (keyof NumericVitals)[];

export interface Vitals extends NumericVitals {
  rhythm: Rhythm;
  /** Capnograph morphology. Absent = 'normal'. */
  capnoShape?: CapnoShape;
  /**
   * Inspired CO2, mmHg — the capnogram's baseline. Normally 0; above zero is
   * rebreathing (exhausted absorbent, a stuck valve). Absent = 0. 0–30.
   */
  fico2?: number;
  /** PVC coupling rate; only meaningful while rhythm is 'pvc'. Absent = 'occasional'. */
  pvcFrequency?: PvcFrequency;
  /** ECG complex morphology (ST, T wave, QRS width, QT). Absent = normal. */
  ecg?: EcgMorphology;
  /**
   * Anesthesia-machine readings. In a scenario's baseline, its presence (even
   * as `{}`) puts the machine tiles on the monitor from the start; fields
   * left out take the defaults for the patient. In a snapshot it is present,
   * with every field, while the tiles are shown.
   */
  vent?: Partial<Ventilation>;
  /** Volatile agent in use. Absent = sevoflurane. */
  agent?: AnestheticAgent;
  /**
   * No pulse despite an organized rhythm: pulseless electrical activity
   * (any organized rhythm) or pulseless VT. Absent = false. VF, torsades,
   * asystole and the legacy `pea` rhythm are pulseless regardless — see
   * hasPulse().
   */
  pulseless?: boolean;
}

/** Mean arterial pressure derived from SBP/DBP. */
export function map(v: Pick<NumericVitals, 'sbp' | 'dbp'>): number {
  return Math.round((v.sbp + 2 * v.dbp) / 3);
}

// ── Scenario definition ──────────────────────────────────────────────────────

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type TrainingLevel =
  | 'medical_student'
  | 'srna'
  | 'saa'
  | 'resident_junior'
  | 'resident_senior'
  | 'crna'
  | 'caa'
  | 'attending';

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  medical_student: 'Medical student',
  srna: 'SRNA',
  saa: 'SAA',
  resident_junior: 'Junior resident',
  resident_senior: 'Senior resident',
  crna: 'CRNA',
  caa: 'CAA',
  attending: 'Attending',
};

export interface ScenarioTags {
  topics: string[];
  difficulty: Difficulty;
  trainingLevels: TrainingLevel[];
}

export interface AirwayExam {
  mallampati: 1 | 2 | 3 | 4;
  mouthOpeningCm?: number;
  thyromentalCm?: number;
  neckMobility?: 'normal' | 'limited' | 'immobile';
  dentition?: string;
  notes?: string;
}

export interface Patient {
  name: string;
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  asa: 1 | 2 | 3 | 4 | 5 | 6;
  allergies: string[];
  medications: string[];
  pmh: string[];
  airway: AirwayExam;
  /** Free-text surgical/anesthetic plan shown to learners at case start. */
  plan?: string;
}

export interface Phase {
  id: string;
  label: string;
  description?: string;
  /**
   * Expected time budget for this phase in seconds — pacing display only
   * (the phase stepper shows elapsed-in-phase vs. target); never drives
   * engine behavior.
   */
  targetDurationSec?: number;
}

/**
 * A change applied to the patient's vitals. Numeric vitals ramp linearly to
 * `vitals` over `overSec` seconds (0 = instant), and so does the ST level in
 * `ecg`. Rhythm, capnogram shape and the other ECG changes are immediate.
 */
export interface VitalEffect {
  vitals?: Partial<NumericVitals>;
  rhythm?: Rhythm;
  /** Capnograph morphology change. Like rhythm, applied immediately. */
  capnoShape?: CapnoShape;
  /** Inspired CO2 target, mmHg. Ramps over `overSec`, like a numeric vital. */
  fico2?: number;
  /** PVC coupling-rate change. Like rhythm, applied immediately. */
  pvcFrequency?: PvcFrequency;
  /** ECG morphology change: only the fields listed change. `stMm` ramps over
   *  `overSec`; T wave, QRS width and QT apply immediately. */
  ecg?: EcgMorphology;
  /** Take the pulse away (true) or give it back (false), independent of the
   *  rhythm. Applied immediately. */
  pulseless?: boolean;
  /** Anesthesia-machine reading targets: only the fields listed change, and
   *  each ramps over `overSec`, like a numeric vital. */
  vent?: Partial<Ventilation>;
  /** Switch the volatile agent. Applied immediately. */
  agent?: AnestheticAgent;
  /** Seconds over which numeric targets are reached. Default 0 (instant). */
  overSec?: number;
  /** Seconds to wait after the trigger before this effect begins. Default 0. */
  afterSec?: number;
}

export type EventCategory =
  | 'physiology'
  | 'airway'
  | 'circulation'
  | 'drug'
  | 'equipment'
  | 'surgical'
  | 'resolution'
  | 'other';

export interface ScenarioEvent {
  id: string;
  label: string;
  description?: string;
  category: EventCategory;
  effects: VitalEffect[];
  /**
   * If set, the engine fires this event automatically this many seconds after
   * the scenario starts (unless the faculty already fired or disabled it).
   */
  autoAtSec?: number;
  /** Optional phase hint shown to faculty ("usually triggered during…"). */
  phaseHint?: string;
  /**
   * Expected learner actions this event embodies or responds to (e.g. an
   * epinephrine-response event ← the "give epinephrine" action). Ids must
   * exist in the scenario's expectedActions; display/grouping only — linking
   * never fires events or marks actions by itself.
   */
  actionIds?: string[];
}

export type ActionStatus = 'pending' | 'done' | 'delayed' | 'missed' | 'incorrect';

export interface ExpectedAction {
  id: string;
  label: string;
  description?: string;
  /** Phase in which this action is expected (for grouping in the UI). */
  phase?: string;
  /** Critical actions are highlighted and heavily weighted in scoring. */
  critical: boolean;
  /** Points awarded when done on time. */
  points: number;
}

export interface RubricCategory {
  id: string;
  label: string;
  /** IDs of expected actions contributing to this category. */
  actionIds: string[];
}

export interface DebriefGuide {
  /** Key discussion points for the facilitator. */
  points: string[];
  /** Suggested open-ended debrief questions. */
  questions: string[];
}

export interface MonitoringConfig {
  /**
   * True = arterial line: BP displays continuously.
   * False/absent = NIBP cuff: BP updates only when the cuff cycles.
   */
  artLine?: boolean;
  /** Automatic cuff cycle interval in seconds (default 180). */
  nibpIntervalSec?: number;
  /**
   * True = the monitor shows a second ECG trace, lead V5, under lead II, with
   * its own ST readout. Absent/false = lead II only. Faculty can add or
   * remove it during a session.
   */
  v5?: boolean;
}

export interface Scenario {
  /** Stable identifier, kebab-case. */
  id: string;
  /** Semver-ish version string for authoring history. */
  version: string;
  title: string;
  summary: string;
  tags: ScenarioTags;
  learningObjectives: string[];
  /** Room / equipment / confederate setup instructions for faculty. */
  setup: string[];
  patient: Patient;
  baselineVitals: Vitals;
  phases: Phase[];
  events: ScenarioEvent[];
  expectedActions: ExpectedAction[];
  /** Narrative description of the expected clinical progression. */
  expectedProgression: string[];
  correctManagement: string[];
  commonErrors: string[];
  debrief: DebriefGuide;
  rubric: RubricCategory[];
  /** Approximate run time in minutes, for the library view. */
  estimatedMinutes: number;
  /**
   * Hard time budget for a scheduled lab slot in seconds — pacing display
   * only (the run screen counts down against it); never drives engine
   * behavior. Distinct from estimatedMinutes, which is a library estimate.
   */
  targetDurationSec?: number;
  /** BP monitoring mode. Absent = NIBP cuff cycling at the default interval. */
  monitoring?: MonitoringConfig;
}

// ── Runtime state ────────────────────────────────────────────────────────────

export type SimStatus = 'idle' | 'running' | 'paused' | 'ended';

export type LogKind =
  | 'session'
  | 'phase'
  | 'event'
  | 'vital_change'
  | 'action'
  | 'note'
  | 'alarm';

export interface LogEntry {
  /** Elapsed scenario seconds at which this occurred. */
  t: number;
  kind: LogKind;
  label: string;
  detail?: string;
}

export interface ActionRecord {
  actionId: string;
  status: ActionStatus;
  /** Elapsed seconds when marked (undefined while pending). */
  markedAtSec?: number;
}

export interface AlarmState {
  /** What the alarm is about: a numeric vital, the rhythm, or a machine
   *  reading (airway pressure, tidal volume, inspired oxygen). */
  vital: keyof NumericVitals | 'rhythm' | 'paw' | 'vt' | 'fio2';
  level: 'warning' | 'critical';
  message: string;
}

/** Last measured NIBP reading (cuff mode). */
export interface NibpReading {
  sbp: number;
  dbp: number;
  /** Elapsed scenario seconds when the cuff read. */
  atSec: number;
}

/**
 * Full serializable simulation state. This is what the faculty controller
 * broadcasts to student displays and what gets archived for debriefing.
 * Vitals history is deliberately NOT part of the snapshot (it is archive-only,
 * via SimulationEngine.getHistory()) to keep the 2/s broadcasts small.
 */
export interface SimSnapshot {
  scenarioId: string;
  sessionId: string;
  status: SimStatus;
  elapsedSec: number;
  phaseId: string;
  /** Elapsed time at the last phase change (phases move via setPhase — the
   *  run screen's phase stepper, or the co-pilot's set_phase command). Kept
   *  in the snapshot for archives and time-in-phase consumers.
   *  Optional: absent in snapshots archived before phase timers existed. */
  phaseChangedAtSec?: number;
  vitals: Vitals;
  /** Last cuff reading; null when the scenario uses an arterial line. */
  nibp: NibpReading | null;
  /**
   * The agent analyzer's derived reading: which agent, and the end-tidal
   * concentration as a multiple of the patient's age-adjusted MAC. Computed
   * by the engine (the display does not know the patient's age). Optional:
   * absent in snapshots archived before it existed.
   */
  gas?: { agent: AnestheticAgent; mac: number };
  /** True while the monitor shows a V5 lead under lead II. Optional: absent
   *  (= lead II only) in snapshots archived before the V5 lead existed. */
  v5Lead?: boolean;
  alarms: AlarmState[];
  /** True while faculty has silenced audible/visual alarm emphasis. */
  alarmsSilenced: boolean;
  actions: ActionRecord[];
  /** In live broadcast snapshots this is a capped tail of the newest entries
   *  (snapshots go out twice a second — an uncapped log would grow every
   *  message with session length). Archived snapshots hold the full log via
   *  `engine.getFullLog()`. */
  log: LogEntry[];
  notes: FacultyNote[];
  firedEventIds: string[];
  /**
   * What the student display shows before the scenario starts: the patient's
   * pre-operative details. Present only while the session is idle and faculty
   * have turned the pre-brief on — absent once the scenario runs, so it adds
   * nothing to the twice-a-second broadcasts of a live session, and never
   * archived (archives are taken at the end).
   */
  preBrief?: PreBrief;
  /** Whether autoAtSec events fire on their own timeline this session.
   *  Optional: absent in snapshots archived before the toggle existed. */
  autoEventsEnabled?: boolean;
}

/**
 * The learner-facing pre-brief. Deliberately the patient only: the scenario's
 * title, summary, objectives and events would give the case away.
 */
export interface PreBrief {
  patient: Patient;
}

export interface FacultyNote {
  t: number;
  text: string;
  /** True when the note was added at debrief, not during the live session.
   *  Optional: absent on notes from archives that predate post-hoc editing. */
  postHoc?: boolean;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface CategoryScore {
  categoryId: string;
  label: string;
  earned: number;
  possible: number;
}

export interface ScoreReport {
  earned: number;
  possible: number;
  /** 0–100 */
  percent: number;
  categories: CategoryScore[];
  criticalMissed: ExpectedAction[];
  criticalDone: ExpectedAction[];
}

// ── Archived session (debrief input) ────────────────────────────────────────

/** Low-frequency vitals sample recorded for the debrief trend strip. */
export interface VitalsHistorySample {
  t: number;
  hr: number;
  sbp: number;
  dbp: number;
  spo2: number;
  etco2: number;
  rr: number;
  temp: number;
}

export interface ArchivedSession {
  sessionId: string;
  /**
   * The code students typed to join (the sync channel name). Usually equals
   * sessionId; differs when the code was reused for back-to-back runs so the
   * student displays never re-joined. Absent in pre-turnover archives.
   */
  sessionCode?: string;
  scenario: Scenario;
  snapshot: SimSnapshot;
  endedAtIso: string;
  score: ScoreReport;
  /** Sampled every 10 s of scenario time. Absent in pre-history archives. */
  history?: VitalsHistorySample[];
  /** Names of the learners in the session, entered at debrief. */
  learnerNames?: string[];
  /**
   * Cloud `scenario_versions.id` the run was pinned to — the exact approved
   * definition the session ran against. Absent offline, for unsynced
   * scenarios, and in pre-pinning archives. The frozen `scenario` above is
   * always the authoritative copy of what ran.
   */
  scenarioVersionId?: number;
}
