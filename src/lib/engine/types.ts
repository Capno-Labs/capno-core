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
  | 'asystole';

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
};

/**
 * Capnograph trace morphology. `normal` is the square expiratory plateau;
 * `bronchospasm` is the slurred, upsloping "shark fin" of obstructed
 * expiration; `curare_cleft` is a normal plateau interrupted by a transient
 * notch — spontaneous respiratory effort during partial neuromuscular
 * blockade. Display-only: the EtCO2 number is unaffected.
 */
export type CapnoShape = 'normal' | 'bronchospasm' | 'curare_cleft';

export const CAPNO_SHAPE_LABELS: Record<CapnoShape, string> = {
  normal: 'Normal',
  bronchospasm: 'Bronchospasm (shark fin)',
  curare_cleft: 'Curare cleft',
};

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
  /** PVC coupling rate; only meaningful while rhythm is 'pvc'. Absent = 'occasional'. */
  pvcFrequency?: PvcFrequency;
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
  | 'resident_junior'
  | 'resident_senior'
  | 'crna'
  | 'attending';

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  medical_student: 'Medical student',
  srna: 'SRNA',
  resident_junior: 'Junior resident',
  resident_senior: 'Senior resident',
  crna: 'CRNA',
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
 * `vitals` over `overSec` seconds (0 = instant). Rhythm changes are immediate.
 */
export interface VitalEffect {
  vitals?: Partial<NumericVitals>;
  rhythm?: Rhythm;
  /** Capnograph morphology change. Like rhythm, applied immediately. */
  capnoShape?: CapnoShape;
  /** PVC coupling-rate change. Like rhythm, applied immediately. */
  pvcFrequency?: PvcFrequency;
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
  vital: keyof NumericVitals | 'rhythm';
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
  /** Elapsed time at the last phase change (phases move via setPhase — today
   *  only the co-pilot's set_phase command calls it). Kept in the snapshot
   *  for archives and time-in-phase consumers.
   *  Optional: absent in snapshots archived before phase timers existed. */
  phaseChangedAtSec?: number;
  vitals: Vitals;
  /** Last cuff reading; null when the scenario uses an arterial line. */
  nibp: NibpReading | null;
  alarms: AlarmState[];
  /** True while faculty has silenced audible/visual alarm emphasis. */
  alarmsSilenced: boolean;
  actions: ActionRecord[];
  log: LogEntry[];
  notes: FacultyNote[];
  firedEventIds: string[];
  /** Whether autoAtSec events fire on their own timeline this session.
   *  Optional: absent in snapshots archived before the toggle existed. */
  autoEventsEnabled?: boolean;
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
}
