import type { Domain } from './lint';
import type { EventCategory, VitalEffect } from './types';

/**
 * Event templates — reusable building blocks the case editor stamps into a
 * scenario as ordinary inline `ScenarioEvent`s. Once inserted the event is
 * the author's to edit; nothing in the engine or schema references
 * templates, and scenario JSON stays fully self-contained and portable.
 *
 * CLINICAL CONTENT NOTICE: every effect below is copied verbatim from an
 * event in the reviewed bundled scenarios (source cited per template), not
 * authored here. Any change to these values is a clinical-content change
 * and needs faculty review. Values are written for the source scenario's
 * patient and baseline — the editor tells authors to verify them for
 * their case.
 *
 * Templates deliberately carry no `autoAtSec`: whether the stamped event is
 * scripted (deterioration) or faculty-fired (treatment response) is the
 * author's call in the editor, guided by `kind`.
 */

export interface EventTemplate {
  id: string;
  label: string;
  /** Shown in the picker before inserting. */
  description: string;
  category: EventCategory;
  /** Curriculum domain, for grouping in the picker. */
  domain: Domain;
  /** Authoring intent — mirrors the structural presets. */
  kind: 'deterioration' | 'treatment-response' | 'resolution' | 'marker';
  effects: VitalEffect[];
  /** Bundled-scenario provenance: "<scenario-id> › <event-id>". */
  source: string;
}

/** Display order + group titles for template pickers (editor and run screen). */
export const TEMPLATE_KINDS: Array<{ kind: EventTemplate['kind']; title: string }> = [
  { kind: 'deterioration', title: 'Deterioration' },
  { kind: 'treatment-response', title: 'Treatment response' },
  { kind: 'resolution', title: 'Resolution' },
  { kind: 'marker', title: 'Marker' },
];

export const EVENT_TEMPLATES: EventTemplate[] = [
  // ── Deterioration ──────────────────────────────────────────────────────
  {
    // Source: intraop-bronchospasm › bronchospasm-onset
    id: 'tpl-bronchospasm-onset',
    label: 'Bronchospasm onset',
    description: 'Shark-fin capnograph appears; EtCO₂ 43, SpO₂ 94, HR 104 over 90 s.',
    category: 'airway',
    domain: 'respiratory',
    kind: 'deterioration',
    effects: [{ vitals: { etco2: 43, spo2: 94, hr: 104 }, capnoShape: 'bronchospasm', overSec: 90 }],
    source: 'intraop-bronchospasm › bronchospasm-onset',
  },
  {
    // Source: intraop-bronchospasm › severe-bronchospasm
    id: 'tpl-severe-bronchospasm',
    label: 'Severe bronchospasm — near-silent chest',
    description: 'EtCO₂ 18, SpO₂ 82, HR 118, BP 108/64, sinus tach over 2 min.',
    category: 'airway',
    domain: 'respiratory',
    kind: 'deterioration',
    effects: [
      {
        vitals: { etco2: 18, spo2: 82, hr: 118, sbp: 108, dbp: 64 },
        rhythm: 'sinus_tach',
        overSec: 120,
      },
    ],
    source: 'intraop-bronchospasm › severe-bronchospasm',
  },
  {
    // Source: laryngospasm-lma › partial-laryngospasm
    id: 'tpl-partial-laryngospasm',
    label: 'Partial laryngospasm',
    description: 'Stridorous obstruction: SpO₂ 92, EtCO₂ 22, RR 22, HR 96 over 90 s.',
    category: 'airway',
    domain: 'airway',
    kind: 'deterioration',
    effects: [{ vitals: { spo2: 92, etco2: 22, rr: 22, hr: 96 }, overSec: 90 }],
    source: 'laryngospasm-lma › partial-laryngospasm',
  },
  {
    // Source: laryngospasm-lma › complete-laryngospasm
    id: 'tpl-complete-laryngospasm',
    label: 'Complete laryngospasm',
    description: 'Airflow ceases (EtCO₂/RR → 0 over 15 s), then SpO₂ falls to 76 with HR 112.',
    category: 'airway',
    domain: 'airway',
    kind: 'deterioration',
    effects: [
      { vitals: { etco2: 0, rr: 0 }, overSec: 15 },
      { vitals: { spo2: 76, hr: 112 }, overSec: 120 },
    ],
    source: 'laryngospasm-lma › complete-laryngospasm',
  },
  {
    // Source: induction-hypotension › post-induction-hypotension
    id: 'tpl-hypotension',
    label: 'Hypotension',
    description: 'BP falls to 72/40 with HR 78 over 90 s.',
    category: 'physiology',
    domain: 'hemodynamics',
    kind: 'deterioration',
    effects: [{ vitals: { sbp: 72, dbp: 40, hr: 78 }, overSec: 90 }],
    source: 'induction-hypotension › post-induction-hypotension',
  },
  {
    // Source: anaphylaxis › full-anaphylaxis
    id: 'tpl-anaphylaxis-full',
    label: 'Anaphylaxis: shock and bronchospasm',
    description: 'BP 55/30, HR 135, SpO₂ 88, EtCO₂ 20, sinus tach, shark-fin CO₂ over 2 min.',
    category: 'circulation',
    domain: 'hypersensitivity',
    kind: 'deterioration',
    effects: [
      {
        vitals: { sbp: 55, dbp: 30, hr: 135, spo2: 88, etco2: 20 },
        rhythm: 'sinus_tach',
        capnoShape: 'bronchospasm',
        overSec: 120,
      },
    ],
    source: 'anaphylaxis › full-anaphylaxis',
  },
  {
    // Source: bradycardia-asystole › vagal-bradycardia-onset
    id: 'tpl-vagal-bradycardia',
    label: 'Vagal bradycardia onset',
    description: 'HR 44 sinus brady, BP 92/54 over 60 s.',
    category: 'physiology',
    domain: 'cardiac',
    kind: 'deterioration',
    effects: [{ vitals: { hr: 44, sbp: 92, dbp: 54 }, rhythm: 'sinus_brady', overSec: 60 }],
    source: 'bradycardia-asystole › vagal-bradycardia-onset',
  },
  {
    // Source: bradycardia-asystole › profound-bradycardia
    id: 'tpl-profound-bradycardia',
    label: 'Profound unstable bradycardia',
    description: 'HR 32, BP 74/42, EtCO₂ 30 over 60 s.',
    category: 'physiology',
    domain: 'cardiac',
    kind: 'deterioration',
    effects: [{ vitals: { hr: 32, sbp: 74, dbp: 42, etco2: 30 }, overSec: 60 }],
    source: 'bradycardia-asystole › profound-bradycardia',
  },
  {
    // Source: bradycardia-asystole › asystole-arrest
    id: 'tpl-asystole-arrest',
    label: 'Asystole',
    description: 'Flatline arrest: all pulses/pressures to 0, EtCO₂ 8 over 15 s.',
    category: 'circulation',
    domain: 'cardiac',
    kind: 'deterioration',
    effects: [
      { vitals: { hr: 0, sbp: 0, dbp: 0, spo2: 0, etco2: 8 }, rhythm: 'asystole', overSec: 15 },
    ],
    source: 'bradycardia-asystole › asystole-arrest',
  },
  {
    // Source: venous-air-embolism › air-lock-pea
    id: 'tpl-pea-arrest',
    label: 'PEA arrest',
    description: 'Organized rhythm (HR 44) without pressures; SpO₂ 0, EtCO₂ 6 over 20 s.',
    category: 'circulation',
    domain: 'cardiac',
    kind: 'deterioration',
    effects: [
      { vitals: { hr: 44, sbp: 0, dbp: 0, spo2: 0, etco2: 6 }, rhythm: 'pea', overSec: 20 },
    ],
    source: 'venous-air-embolism › air-lock-pea',
  },
  {
    // Source: malignant-hyperthermia › fulminant-mh
    id: 'tpl-hypermetabolic-crisis',
    label: 'Hypermetabolic crisis (MH-type)',
    description: 'EtCO₂ 92, HR 140, BP 138/82 over 7 min; temp climbs to 39.8 over 10 min.',
    category: 'physiology',
    domain: 'temperature/metabolic',
    kind: 'deterioration',
    effects: [
      {
        vitals: { etco2: 92, hr: 140, sbp: 138, dbp: 82, spo2: 94 },
        rhythm: 'sinus_tach',
        overSec: 420,
      },
      { vitals: { temp: 39.8 }, overSec: 600 },
    ],
    source: 'malignant-hyperthermia › fulminant-mh',
  },
  {
    // Source: postpartum-hemorrhage › decompensated-shock
    id: 'tpl-hemorrhagic-shock',
    label: 'Decompensated hemorrhagic shock',
    description: 'HR 136, BP 78/52, SpO₂ 94, RR 26, EtCO₂ 26, temp 36.2 over 2.5 min.',
    category: 'circulation',
    domain: 'hemorrhage',
    kind: 'deterioration',
    effects: [
      {
        vitals: { hr: 136, sbp: 78, dbp: 52, spo2: 94, rr: 26, etco2: 26, temp: 36.2 },
        overSec: 150,
      },
    ],
    source: 'postpartum-hemorrhage › decompensated-shock',
  },
  {
    // Source: venous-air-embolism › subtle-etco2-decline
    id: 'tpl-etco2-fall',
    label: 'Abrupt unexplained EtCO₂ fall',
    description: 'Isolated capnograph signal: EtCO₂ to 26 over 60 s, all else unchanged.',
    category: 'physiology',
    domain: 'embolic',
    kind: 'deterioration',
    effects: [{ vitals: { etco2: 26 }, overSec: 60 }],
    source: 'venous-air-embolism › subtle-etco2-decline',
  },
  // ── Treatment response ─────────────────────────────────────────────────
  {
    // Source: anaphylaxis › epinephrine-bolus-response
    id: 'tpl-epinephrine-bolus-response',
    label: 'Epinephrine bolus response (shock)',
    description: 'BP recovers to 85/48, HR 128, SpO₂ 93, EtCO₂ 28 over 60 s.',
    category: 'drug',
    domain: 'hypersensitivity',
    kind: 'treatment-response',
    effects: [{ vitals: { sbp: 85, dbp: 48, hr: 128, spo2: 93, etco2: 28 }, overSec: 60 }],
    source: 'anaphylaxis › epinephrine-bolus-response',
  },
  {
    // Source: intraop-bronchospasm › epinephrine-response
    id: 'tpl-epinephrine-response-bronchospasm',
    label: 'Epinephrine response (refractory bronchospasm)',
    description: 'SpO₂ 94, EtCO₂ 33, HR 124, BP 122/74 over 90 s.',
    category: 'drug',
    domain: 'respiratory',
    kind: 'treatment-response',
    effects: [
      { vitals: { spo2: 94, etco2: 33, hr: 124, sbp: 122, dbp: 74 }, overSec: 90 },
    ],
    source: 'intraop-bronchospasm › epinephrine-response',
  },
  {
    // Source: bradycardia-asystole › pacing-capture
    id: 'tpl-pacing-capture',
    label: 'Transcutaneous pacing with capture',
    description: 'Paced rhythm restores HR 80, BP 104/62 over 45 s.',
    category: 'equipment',
    domain: 'cardiac',
    kind: 'treatment-response',
    effects: [{ vitals: { hr: 80, sbp: 104, dbp: 62 }, rhythm: 'sinus', overSec: 45 }],
    source: 'bradycardia-asystole › pacing-capture',
  },
  // ── Resolution ─────────────────────────────────────────────────────────
  {
    // Source: bradycardia-asystole › rosc-after-cpr
    id: 'tpl-rosc',
    label: 'ROSC after CPR',
    description: 'Return of circulation: HR 52 sinus brady, BP 92/56, SpO₂ 96, EtCO₂ 44 over 30 s.',
    category: 'resolution',
    domain: 'cardiac',
    kind: 'resolution',
    effects: [
      {
        vitals: { hr: 52, sbp: 92, dbp: 56, spo2: 96, etco2: 44 },
        rhythm: 'sinus_brady',
        overSec: 30,
      },
    ],
    source: 'bradycardia-asystole › rosc-after-cpr',
  },
  {
    // Source: bradycardia-asystole › stabilization-achieved
    id: 'tpl-stabilization',
    label: 'Stabilization achieved',
    description: 'Gradual return toward normal: HR 76, BP 116/70, SpO₂ 99, EtCO₂ 36, RR 12 over 4 min.',
    category: 'resolution',
    domain: 'cardiac',
    kind: 'resolution',
    effects: [
      {
        vitals: { hr: 76, sbp: 116, dbp: 70, spo2: 99, etco2: 36, rr: 12 },
        rhythm: 'sinus',
        overSec: 240,
      },
    ],
    source: 'bradycardia-asystole › stabilization-achieved',
  },
  // ── Marker ─────────────────────────────────────────────────────────────
  {
    // Source: postpartum-hemorrhage › txa-given (structure; log-only)
    id: 'tpl-drug-given-marker',
    label: 'Drug given (log only)',
    description: 'No vital effects — writes a log line marking an administration or exposure.',
    category: 'drug',
    domain: 'hemorrhage',
    kind: 'marker',
    effects: [],
    source: 'postpartum-hemorrhage › txa-given',
  },
];
