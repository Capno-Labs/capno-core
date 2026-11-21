import type {
  AlarmBand,
  AlarmLimits,
  AlarmProfile,
  AlarmState,
  AlarmVital,
  AnestheticAgent,
  MonitoringConfig,
  NeuromuscularBlock,
  NmbKey,
  NumericVitals,
  Patient,
  TofReading,
  Ventilation,
  VentKey,
  Vitals,
} from './types';
import {
  ALARM_BAND_KEYS,
  ALARM_VITALS,
  hasPulse,
  minuteVentilation,
  NMB_META,
  NUMERIC_VITAL_KEYS,
  VENT_META,
} from './types';

/** Display metadata for each numeric vital (units, formatting, slider range). */
export interface VitalMeta {
  key: keyof NumericVitals;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

export const VITAL_META: Record<keyof NumericVitals, VitalMeta> = {
  hr: { key: 'hr', label: 'HR', unit: 'bpm', min: 0, max: 220, step: 1, decimals: 0 },
  sbp: { key: 'sbp', label: 'SBP', unit: 'mmHg', min: 0, max: 260, step: 1, decimals: 0 },
  dbp: { key: 'dbp', label: 'DBP', unit: 'mmHg', min: 0, max: 160, step: 1, decimals: 0 },
  spo2: { key: 'spo2', label: 'SpO₂', unit: '%', min: 0, max: 100, step: 1, decimals: 0 },
  etco2: { key: 'etco2', label: 'EtCO₂', unit: 'mmHg', min: 0, max: 120, step: 1, decimals: 0 },
  rr: { key: 'rr', label: 'RR', unit: '/min', min: 0, max: 60, step: 1, decimals: 0 },
  temp: { key: 'temp', label: 'Temp', unit: '°C', min: 30, max: 44, step: 0.1, decimals: 1 },
  depth: { key: 'depth', label: 'Depth', unit: '', min: 0, max: 100, step: 1, decimals: 0 },
  // Up to 18%: a desflurane vaporizer's range (sevoflurane's stops at 8).
  agentEt: { key: 'agentEt', label: 'Et Agent', unit: '%', min: 0, max: 18, step: 0.1, decimals: 1 },
  agentFi: { key: 'agentFi', label: 'Fi Agent', unit: '%', min: 0, max: 18, step: 0.1, decimals: 1 },
};

export const DEFAULT_VITALS: Vitals = {
  hr: 72,
  sbp: 120,
  dbp: 75,
  spo2: 98,
  etco2: 36,
  rr: 14,
  temp: 36.6,
  depth: 95,
  agentEt: 0,
  agentFi: 0,
  rhythm: 'sinus',
};

/** Clamp a numeric vital to its physically renderable range. */
export function clampVital(key: keyof NumericVitals, value: number): number {
  const m = VITAL_META[key];
  return Math.min(m.max, Math.max(m.min, value));
}

/**
 * The *measured* end-tidal CO2 a capnometer would report for a given
 * true (faculty/scenario-set) etCO2 at the current respiratory rate.
 *
 * At apnea (`rr <= 0`) there is no exhaled breath to sample, so the
 * capnograph flattens and the number reads 0 ("no CO₂ detected") — this makes
 * the numeric EtCO₂ tile agree with the already-flat capnograph waveform.
 *
 * Note: this intentionally does NOT model a general RR→etCO₂ coupling
 * (hypoventilation raising CO₂). Scenarios author etCO₂ directly to represent
 * the actual gas-exchange state — including airway-obstruction cases that pair
 * a low RR with a *low* measured etCO₂ — so a blanket "lower RR ⇒ higher CO₂"
 * rule would fight authored content. etCO₂ otherwise stays faculty/scenario
 * driven; only true apnea is transformed here — and a tube in the esophagus
 * (`esophagealBreaths` given), where the CO2 a capnometer sees dies away.
 */
export function measuredEtco2(
  trueEtco2: number,
  rr: number,
  esophagealBreaths?: number,
): number {
  if (rr <= 0) return 0;
  if (esophagealBreaths !== undefined) return esophagealEtco2(trueEtco2, esophagealBreaths);
  return trueEtco2;
}

/**
 * A tube in the esophagus usually shows no CO2 at all, but after mask
 * ventilation a little can come back from the stomach: the first reading is
 * usually under 10 mmHg and falls with every breath, which is why the trace
 * is only judged once it has been sustained — at consistent or rising
 * amplitude, peaking more than 7.5 mmHg above baseline — for at least seven
 * breaths (Chrimes et al., Anaesthesia 2022;77:1395, the PUMA guideline;
 * Anderson & Breen, Crit Care 2000;4:207).
 *
 * So: a first breath of at most ESOPHAGEAL_FIRST_MMHG — under both of those
 * marks — shrinking by ESOPHAGEAL_DECAY each breath, and nothing from the
 * seventh breath on.
 */
export const ESOPHAGEAL_FIRST_MMHG = 7;
export const ESOPHAGEAL_DECAY = 0.7;
/** Breaths that show any CO2 at all. */
export const ESOPHAGEAL_BREATHS = 6;

/**
 * What a capnometer reads from a tube in the esophagus, `breaths` after it was
 * placed. `trueEtco2` is what the same patient would show from the trachea;
 * it only caps the first reading.
 */
export function esophagealEtco2(trueEtco2: number, breaths: number): number {
  const breath = Math.max(0, Math.floor(breaths));
  if (breath >= ESOPHAGEAL_BREATHS) return 0;
  return Math.min(trueEtco2, ESOPHAGEAL_FIRST_MMHG) * Math.pow(ESOPHAGEAL_DECAY, breath);
}

/** Inspired CO2 above this raises an alarm, mmHg: the factory default of the
 *  "imCO2 High" limit (Philips IntelliVue MX750/MX850 Instructions for Use;
 *  IntelliVue Configuration Guide, Rel. G.0). */
export const FICO2_ALARM_HIGH = 4;

// ── Neuromuscular monitoring ─────────────────────────────────────────────────

/** Clamp a neuromuscular-block field to its range. */
export function clampNmb(key: NmbKey, value: number): number {
  const m = NMB_META[key];
  return Math.min(m.max, Math.max(m.min, value));
}

/**
 * Seconds between the twitch monitor's automatic measurements: 15, the cycle
 * of an Organon TOF-Watch SX (Operator Manual 33.512/A) and an option on an
 * IDMED TOFscan. Trains should be at least 12 s apart (Fuchs-Buder et al.,
 * Acta Anaesthesiol Scand 2023;67:994, Table 3); a Blink TwitchView repeats
 * every 20 s and a Philips IntelliVue NMT offers 12 s to 60 min.
 */
export const TOF_INTERVAL_SEC = 15;

/**
 * Depth of block, as the 2023 ASA guideline grades it for a quantitative
 * monitor (Thilen et al., Anesthesiology 2023;138:13, depth-of-block table;
 * the same scheme is in Fuchs-Buder et al. 2023, Table 10):
 * complete — post-tetanic count 0; deep — post-tetanic count 1 or more with
 * no train-of-four response; moderate — count 1–3; shallow — ratio under
 * 0.4; minimal — ratio 0.4 to under 0.9; acceptable recovery — 0.9 or more.
 */
export type BlockDepth = 'complete' | 'deep' | 'moderate' | 'shallow' | 'minimal' | 'recovered';

export const BLOCK_DEPTH_LABELS: Record<BlockDepth, string> = {
  complete: 'complete block',
  deep: 'deep block',
  moderate: 'moderate block',
  shallow: 'shallow block',
  minimal: 'minimal block',
  recovered: 'acceptable recovery',
};

/** Ratio (%) at and above which recovery is acceptable — the ASA's threshold
 *  to confirm before extubation (Thilen 2023, recommendation 3). */
export const TOF_RATIO_RECOVERED = 90;
/** Ratio (%) below which a four-twitch block is shallow rather than minimal. */
export const TOF_RATIO_MINIMAL = 40;

export function blockDepth(reading: Pick<TofReading, 'count' | 'ratio' | 'ptc'>): BlockDepth {
  if (reading.count === 0) return (reading.ptc ?? 0) >= 1 ? 'deep' : 'complete';
  if (reading.count < 4 || reading.ratio === null) return 'moderate';
  if (reading.ratio < TOF_RATIO_MINIMAL) return 'shallow';
  return reading.ratio < TOF_RATIO_RECOVERED ? 'minimal' : 'recovered';
}

/**
 * What a twitch monitor reads from a block: the count, the ratio only when
 * all four twitches are present, and the post-tetanic count only when none
 * is.
 */
export function tofReading(nmb: NeuromuscularBlock, atSec: number): TofReading {
  const count = Math.round(clampNmb('tofCount', nmb.tofCount));
  return {
    count,
    ratio: count === 4 ? Math.round(clampNmb('tofRatio', nmb.tofRatio)) : null,
    ptc: count === 0 ? Math.round(clampNmb('ptc', nmb.ptc)) : null,
    atSec,
  };
}

// ── Anesthesia machine ───────────────────────────────────────────────────────

/** Clamp a machine reading to its range. */
export function clampVent(key: VentKey, value: number): number {
  const m = VENT_META[key];
  return Math.min(m.max, Math.max(m.min, value));
}

/**
 * Predicted body weight, kg, from height and sex — the ARDS Network formula
 * (NEJM 2000;342:1301), as given in Sasko et al., PLoS One 2018;13:e0199917:
 * 50 (men) or 45.5 (women) + 0.91 × (height in cm − 152.4).
 */
export function predictedBodyWeightKg(patient: Pick<Patient, 'sex' | 'heightCm'>): number {
  const base = patient.sex === 'male' ? PBW.male : PBW.female;
  return Math.max(PBW.floorKg, base + PBW.perCm * (patient.heightCm - PBW.fromCm));
}
const PBW = { male: 50, female: 45.5, perCm: 0.91, fromCm: 152.4, floorKg: 25 } as const;

/** Tidal volume for the default setting, mL per kg of predicted body weight:
 *  the middle of the 6–8 recommended for intraoperative lung-protective
 *  ventilation (Young et al., Br J Anaesth 2019;123:898). */
export const DEFAULT_VT_ML_PER_KG = 7;

/**
 * What the machine reads for a ventilated patient of this size with healthy
 * lungs — the starting point when a scenario shows the machine tiles without
 * saying what they read.
 *  - Tidal volume 7 mL/kg predicted body weight, PEEP 5 cmH2O: the initial
 *    settings of the international consensus (Young et al. 2019).
 *  - Peak 18 and plateau 16 cmH2O: the medians in 9,864 surgical patients
 *    were 17.5 and 15.5 (LAS VEGAS investigators, Eur J Anaesthesiol
 *    2017;34:492).
 *  - FiO2 50%: the median in that study was 0.52, and 0.5 is standard UK
 *    practice (Morkane et al., Perioper Med 2018;7:17). Guidance conflicts —
 *    the WHO recommends 0.8, others 0.21–0.4 — so this is practice, not advice.
 */
export function defaultVentilation(patient: Pick<Patient, 'sex' | 'heightCm'>): Ventilation {
  const vt = Math.round((DEFAULT_VT_ML_PER_KG * predictedBodyWeightKg(patient)) / 10) * 10;
  return { fio2: 50, pip: 18, pplat: 16, peep: 5, vt };
}

/**
 * Machine alarm limits: the factory defaults of a Dräger Fabius GS premium
 * (Instructions for Use, SW 3.n, 9038906 ed. 7): airway pressure high 40 and
 * low (apnea) threshold 8 cmH2O, minute volume 3.0–12.0 L/min, oxygen low
 * 20%. Defaults differ by maker — a Mindray A7 ships with pressure 50/10,
 * minute volume low 1 and oxygen low 18%. The real machine waits 15–30 s
 * below the pressure threshold before alarming; here it is immediate.
 */
export const MACHINE_ALARM_LIMITS = {
  pawHigh: 40,
  pawLow: 8,
  mvLow: 3,
  mvHigh: 12,
  fio2Low: 20,
} as const;

/**
 * MAC at age 40 in oxygen, % end-tidal (Mapleson, Br J Anaesth 1996;76:179).
 */
export const MAC_AT_40: Record<AnestheticAgent, number> = {
  sevoflurane: 1.8,
  isoflurane: 1.17,
  desflurane: 6.6,
};

/**
 * MAC for a patient of this age, %: MAC40 × 10^(−0.00269 × (age − 40)), a
 * fall of about 6% per decade, for ages over 1 year (Mapleson 1996; the
 * basis of the Nickalls & Mapleson iso-MAC charts, Br J Anaesth 2003;91:170).
 */
export function ageAdjustedMac(agent: AnestheticAgent, ageYears: number): number {
  return MAC_AT_40[agent] * Math.pow(10, -0.00269 * (ageYears - 40));
}

/** End-tidal concentration as a multiple of the patient's age-adjusted MAC. */
export function macMultiple(agent: AnestheticAgent, endTidalPercent: number, ageYears: number): number {
  return endTidalPercent / ageAdjustedMac(agent, ageYears);
}

/** Minimum systolic−diastolic gap the sim will display (mmHg). A narrower
 *  pulse pressure isn't a plausible monitor reading, so both the engine and
 *  scenario validation enforce it. */
export const MIN_PULSE_PRESSURE = 20;

/** Highest diastolic allowed for a given systolic: sbp − MIN_PULSE_PRESSURE,
 *  floored at 0 so arrest states (0/0) stay representable. */
export function maxDbpFor(sbp: number): number {
  return Math.max(0, sbp - MIN_PULSE_PRESSURE);
}

export function roundVital(key: keyof NumericVitals, value: number): number {
  const f = 10 ** VITAL_META[key].decimals;
  return Math.round(value * f) / f;
}

/**
 * Alarm limits by patient category.
 *
 * Adult: the sim's long-standing set — conventional intraoperative limits,
 * a little tighter than a monitor's factory defaults (a Philips IntelliVue
 * ships adult limits of HR 50–120, SpO2 90, systolic 90–160, RR 8–30, EtCO2
 * 25–60, temperature 36–39).
 *
 * Pediatric and neonatal change what a monitor changes with the category —
 * heart rate, breathing rate, blood pressure and, for neonates, saturation —
 * using the factory defaults of a Philips IntelliVue MX750/MX850
 * (Instructions for Use 453564861711, "Alarm and Measurement Default
 * Settings", pp. 525–540):
 *  - HR: pediatric 75–160, neonatal 100–200. Critical is the monitor's
 *    extreme bradycardia/tachycardia, 20 bpm beyond each limit.
 *  - NBP systolic: pediatric 70–120, neonatal 40–90. Critical is 10
 *    (pediatric) or 5 mmHg (neonatal) beyond — the monitor's extreme
 *    pressure difference, which it ships switched off.
 *  - RR: pediatric 8–30, neonatal 30–100. The sim's own critical tier (under
 *    4, over 35) is kept where it still lies outside those limits.
 *  - SpO2, neonatal: low 85, critical at the desaturation limit of 80. The
 *    monitor also alarms above 95 in a neonate; the sim has no high
 *    saturation alarm.
 * EtCO2 and temperature are the same for every category on that monitor, so
 * they stay as the adult set.
 */
export const ALARM_PROFILES: Record<AlarmProfile, AlarmLimits> = {
  adult: {
    hr: { warnLow: 50, warnHigh: 110, critLow: 40, critHigh: 140 },
    sbp: { warnLow: 90, warnHigh: 160, critLow: 70, critHigh: 200 },
    spo2: { warnLow: 92, critLow: 85 },
    etco2: { warnLow: 25, warnHigh: 50, critLow: 15, critHigh: 60 },
    rr: { warnLow: 8, warnHigh: 24, critLow: 4, critHigh: 35 },
    temp: { warnLow: 35.0, warnHigh: 38.0, critHigh: 39.5 },
  },
  pediatric: {
    hr: { warnLow: 75, warnHigh: 160, critLow: 55, critHigh: 180 },
    sbp: { warnLow: 70, warnHigh: 120, critLow: 60, critHigh: 130 },
    spo2: { warnLow: 92, critLow: 85 },
    etco2: { warnLow: 25, warnHigh: 50, critLow: 15, critHigh: 60 },
    rr: { warnLow: 8, warnHigh: 30, critLow: 4, critHigh: 35 },
    temp: { warnLow: 35.0, warnHigh: 38.0, critHigh: 39.5 },
  },
  neonatal: {
    hr: { warnLow: 100, warnHigh: 200, critLow: 80, critHigh: 220 },
    sbp: { warnLow: 40, warnHigh: 90, critLow: 35, critHigh: 95 },
    spo2: { warnLow: 85, critLow: 80 },
    etco2: { warnLow: 25, warnHigh: 50, critLow: 15, critHigh: 60 },
    rr: { warnLow: 30, warnHigh: 100, critLow: 4 },
    temp: { warnLow: 35.0, warnHigh: 38.0, critHigh: 39.5 },
  },
};

/**
 * The limits a scenario's monitor uses: its profile (adult if unstated) with
 * the scenario's own changes laid over it. `null` switches a limit off.
 */
export function resolveAlarmLimits(
  monitoring?: Pick<MonitoringConfig, 'alarmProfile' | 'alarmLimits'>,
): AlarmLimits {
  const profile = ALARM_PROFILES[monitoring?.alarmProfile ?? 'adult'];
  const limits = {} as AlarmLimits;
  for (const vital of ALARM_VITALS) {
    const band: AlarmBand = { ...profile[vital] };
    const changes = monitoring?.alarmLimits?.[vital];
    for (const key of ALARM_BAND_KEYS) {
      const value = changes?.[key];
      if (value === null) delete band[key];
      else if (value !== undefined) band[key] = value;
    }
    limits[vital] = band;
  }
  return limits;
}

/**
 * What is wrong with a set of limits, if anything: a critical limit must lie
 * at or beyond its warning limit, and low below high. Empty = consistent.
 */
export function alarmLimitProblems(limits: AlarmLimits): { vital: AlarmVital; message: string }[] {
  const problems: { vital: AlarmVital; message: string }[] = [];
  for (const vital of ALARM_VITALS) {
    const { critLow, warnLow, warnHigh, critHigh } = limits[vital];
    const label = VITAL_META[vital].label;
    const bad = (message: string) => problems.push({ vital, message: `${label}: ${message}` });
    if (critLow !== undefined && warnLow !== undefined && critLow > warnLow) {
      bad(`critical low (${critLow}) must not be above the low warning (${warnLow})`);
    }
    if (critHigh !== undefined && warnHigh !== undefined && critHigh < warnHigh) {
      bad(`critical high (${critHigh}) must not be below the high warning (${warnHigh})`);
    }
    const lows = [critLow, warnLow].filter((n): n is number => n !== undefined);
    const highs = [warnHigh, critHigh].filter((n): n is number => n !== undefined);
    if (lows.length > 0 && highs.length > 0 && Math.max(...lows) >= Math.min(...highs)) {
      bad(`low limits must be below high limits`);
    }
  }
  return problems;
}

const LETHAL_RHYTHMS = new Set(['vtach', 'vfib', 'torsades', 'pea', 'asystole']);

/** Evaluate the current vitals against alarm limits. */
export function evaluateAlarms(vitals: Vitals, limits: AlarmLimits = ALARM_PROFILES.adult): AlarmState[] {
  const alarms: AlarmState[] = [];

  if (LETHAL_RHYTHMS.has(vitals.rhythm)) {
    alarms.push({
      vital: 'rhythm',
      level: 'critical',
      message: `RHYTHM: ${vitals.rhythm.toUpperCase().replace('_', ' ')}`,
    });
  }

  // Anesthesia machine, when its readings are on the monitor.
  const vent = vitals.vent;
  if (vent && vent.pip !== undefined && vent.vt !== undefined && vent.fio2 !== undefined) {
    const lim = MACHINE_ALARM_LIMITS;
    if (vent.pip > lim.pawHigh) {
      alarms.push({ vital: 'paw', level: 'critical', message: `Paw HIGH ${vent.pip}` });
    } else if (vent.pip < lim.pawLow) {
      // No pressure being generated: a disconnection, or no ventilation.
      alarms.push({ vital: 'paw', level: 'critical', message: 'APNEA PRESSURE' });
    }
    const mv = minuteVentilation(vent.vt, vitals.rr);
    if (mv < lim.mvLow) {
      alarms.push({ vital: 'vt', level: 'warning', message: `MV low ${mv.toFixed(1)}` });
    } else if (mv > lim.mvHigh) {
      alarms.push({ vital: 'vt', level: 'warning', message: `MV high ${mv.toFixed(1)}` });
    }
    if (vent.fio2 < lim.fio2Low) {
      alarms.push({ vital: 'fio2', level: 'critical', message: `FiO₂ LOW ${vent.fio2}` });
    }
  }

  // Rebreathing: the baseline no longer returns to zero.
  const fico2 = vitals.fico2 ?? 0;
  if (fico2 > FICO2_ALARM_HIGH) {
    alarms.push({ vital: 'etco2', level: 'warning', message: `FiCO₂ high ${Math.round(fico2)}` });
  }

  // An oximeter with no pulse to read raises a technical alarm, not a number.
  // With an organized rhythm on the ECG this may be the only alarm — the
  // heart rate looks fine. That is PEA, and the monitor will not name it.
  const noPulse = !hasPulse(vitals);

  for (const vital of ALARM_VITALS) {
    const lim = { vital, ...limits[vital] };
    const v = vitals[lim.vital];
    const meta = VITAL_META[lim.vital];
    if (lim.vital === 'spo2' && noPulse) {
      const critical = lim.critLow !== undefined && v < lim.critLow;
      alarms.push({ vital: 'spo2', level: critical ? 'critical' : 'warning', message: 'SpO₂ NO PULSE' });
      continue;
    }
    if (lim.critLow !== undefined && v < lim.critLow) {
      alarms.push({ vital: lim.vital, level: 'critical', message: `${meta.label} LOW ${v.toFixed(meta.decimals)}` });
    } else if (lim.critHigh !== undefined && v > lim.critHigh) {
      alarms.push({ vital: lim.vital, level: 'critical', message: `${meta.label} HIGH ${v.toFixed(meta.decimals)}` });
    } else if (lim.warnLow !== undefined && v < lim.warnLow) {
      alarms.push({ vital: lim.vital, level: 'warning', message: `${meta.label} low ${v.toFixed(meta.decimals)}` });
    } else if (lim.warnHigh !== undefined && v > lim.warnHigh) {
      alarms.push({ vital: lim.vital, level: 'warning', message: `${meta.label} high ${v.toFixed(meta.decimals)}` });
    }
  }

  return alarms;
}

export { NUMERIC_VITAL_KEYS };
