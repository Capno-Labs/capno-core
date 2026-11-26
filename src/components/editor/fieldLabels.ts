import type { NumericVitals } from '@/lib/engine/types';

/**
 * The names the editor shows for a case's fields, in one place: the forms
 * label their inputs with them and the readiness checklist (readiness.ts)
 * uses the same words to say where a problem is, so "Show me" can find the
 * field by its label.
 */

/** Long names for the numbers — the monitor's abbreviations are for the monitor. */
export const VITAL_NAMES: Record<keyof NumericVitals, string> = {
  hr: 'Heart rate',
  sbp: 'Systolic BP',
  dbp: 'Diastolic BP',
  spo2: 'SpO₂',
  etco2: 'EtCO₂',
  rr: 'Respiratory rate',
  temp: 'Temperature',
  depth: 'Depth of anesthesia',
  agentEt: 'End-tidal agent',
  agentFi: 'Inspired agent',
};

/** Dot path (list indexes dropped) → the label on its field. */
export const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  summary: 'Summary',
  'tags.difficulty': 'Difficulty',
  'tags.trainingLevels': 'Training levels',
  'tags.topics': 'Curriculum area',
  estimatedMinutes: 'Expected length',
  targetDurationSec: 'Lab slot',
  learningObjectives: 'Objectives',
  setup: 'Setup steps',

  'patient.name': 'Name',
  'patient.age': 'Age',
  'patient.sex': 'Sex',
  'patient.weightKg': 'Weight',
  'patient.heightCm': 'Height',
  'patient.asa': 'ASA class',
  'patient.plan': 'Surgical and anesthetic plan',
  'patient.airway.mallampati': 'Mallampati',
  'patient.airway.mouthOpeningCm': 'Mouth opening',
  'patient.airway.thyromentalCm': 'Thyromental distance',
  'patient.airway.neckMobility': 'Neck mobility',
  'patient.airway.dentition': 'Dentition',
  'patient.airway.notes': 'Airway notes',
  'patient.allergies': 'Allergies',
  'patient.medications': 'Medications',
  'patient.pmh': 'Past medical history',

  'baselineVitals.rhythm': 'Rhythm',
  'baselineVitals.pvcFrequency': 'PVC frequency',
  'baselineVitals.capnoShape': 'CO₂ waveform',
  'baselineVitals.fico2': 'Inspired CO₂',
  'baselineVitals.pulseless': 'Pulse',
  'monitoring.nibpIntervalSec': 'Cuff cycles every',

  expectedProgression: 'Expected progression',
  correctManagement: 'Correct management',
  commonErrors: 'Common errors',
  'debrief.questions': 'Debrief questions',
  'debrief.points': 'Teaching points',

  id: 'Case ID',
  version: 'Version label',
};

/** Groups of fields that sit together behind one heading, by path prefix. */
export const GROUP_LABELS: [prefix: string, label: string][] = [
  ['baselineVitals.vent', 'Anesthesia machine'],
  ['baselineVitals.agent', 'Depth and anesthetic agent'],
  ['baselineVitals.nmb', 'Twitch monitor'],
  ['baselineVitals.ecg', 'ECG detail'],
  ['monitoring.alarm', 'Alarm limits'],
  ['monitoring', 'Monitoring'],
  ['patient.airway', 'Airway exam'],
];
