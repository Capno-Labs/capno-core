import type {
  Rhythm,
  ScenarioEvent,
  SimSnapshot,
  VitalsHistorySample,
} from '../engine/types';
import { RHYTHM_LABELS } from '../engine/types';
import { DEFAULT_VITALS, evaluateAlarms, VITAL_META } from '../engine/vitals';

/**
 * Key clinical turning points, derived for the debrief report from data the
 * archive already carries. Pure presentation logic: every label is engine log
 * text or a vital name — nothing clinical is generated here (invariant 7).
 *
 * The engine declares an 'alarm' log kind but never writes it, so alarm
 * crossings are reconstructed from the 10 s vitals history. In cuff mode, BP
 * points come from the logged NIBP readings, not live history — the debrief
 * must not reveal pressures the monitor never displayed (the stale-NIBP
 * teaching point).
 */

export interface TurningPoint {
  /** Elapsed scenario seconds. */
  t: number;
  kind: 'event' | 'phase' | 'rhythm' | 'alarm' | 'recovery';
  severity: 'info' | 'warning' | 'critical';
  label: string;
  detail?: string;
}

/** Structural subset of ArchivedSession so tests stay light. */
export interface TurningPointInput {
  snapshot: Pick<SimSnapshot, 'log'>;
  scenario: {
    events: readonly Pick<ScenarioEvent, 'label' | 'category'>[];
    monitoring?: { artLine?: boolean };
  };
  history?: VitalsHistorySample[];
}

const LETHAL_RHYTHMS: ReadonlySet<Rhythm> = new Set(['vtach', 'vfib', 'pea', 'asystole']);

const RHYTHM_LOG_PREFIX = 'Rhythm → ';
const NIBP_LOG_RE = /^NIBP (\d+)\/(\d+)$/;

/** Suppress repeat alarm/recovery points for the same vital within this window. */
const COALESCE_SEC = 30;

type AlarmLevel = 0 | 1 | 2; // none | warning | critical

const LEVEL_SEVERITY = { 1: 'warning', 2: 'critical' } as const;

/** History-sample vitals that evaluateAlarms has limits for, minus BP (handled per mode). */
const HISTORY_ALARM_KEYS = ['hr', 'spo2', 'etco2', 'rr', 'temp'] as const;

function labelToRhythm(label: string): Rhythm | null {
  const entry = Object.entries(RHYTHM_LABELS).find(([, l]) => l === label);
  return entry ? (entry[0] as Rhythm) : null;
}

/**
 * Per-vital escalation tracker: emits on level increases (a strictly new
 * high always emits; re-entries coalesce within COALESCE_SEC) and one
 * recovery point when the vital returns inside warning limits.
 */
class EscalationTracker {
  private cur: AlarmLevel = 0;
  private maxEmitted: AlarmLevel = 0;
  private lastPointT = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly vitalLabel: string,
    private readonly out: TurningPoint[],
  ) {}

  observe(t: number, level: AlarmLevel, message: string | undefined): void {
    if (level > this.cur) {
      const escalatesPastPrior = level > this.maxEmitted;
      if (escalatesPastPrior || t - this.lastPointT >= COALESCE_SEC) {
        this.out.push({
          t,
          kind: 'alarm',
          severity: LEVEL_SEVERITY[level as 1 | 2],
          label: message ?? `${this.vitalLabel} alarm`,
        });
        this.lastPointT = t;
        if (escalatesPastPrior) this.maxEmitted = level;
      }
    } else if (level === 0 && this.cur > 0) {
      if (t - this.lastPointT >= COALESCE_SEC) {
        this.out.push({
          t,
          kind: 'recovery',
          severity: 'info',
          label: `${this.vitalLabel} back in range`,
        });
        this.lastPointT = t;
        // A fresh excursion after an acknowledged recovery emits again;
        // silent flaps around a threshold stay coalesced.
        this.maxEmitted = 0;
      }
    }
    this.cur = level;
  }
}

function alarmLevelFor(
  alarms: ReturnType<typeof evaluateAlarms>,
  vital: string,
): { level: AlarmLevel; message?: string } {
  const hit = alarms.find((a) => a.vital === vital);
  if (!hit) return { level: 0 };
  return { level: hit.level === 'critical' ? 2 : 1, message: hit.message };
}

export function deriveTurningPoints(session: TurningPointInput): TurningPoint[] {
  const points: TurningPoint[] = [];
  const { log } = session.snapshot;
  const artLine = session.scenario.monitoring?.artLine ?? false;
  const eventCategoryByLabel = new Map(
    session.scenario.events.map((e) => [e.label, e.category]),
  );

  // Events, phases, and rhythm changes come straight from the log.
  for (const entry of log) {
    if (entry.kind === 'event') {
      const category = eventCategoryByLabel.get(entry.label);
      points.push({
        t: entry.t,
        kind: 'event',
        severity: category === 'resolution' ? 'info' : 'warning',
        label: entry.label,
        detail: entry.detail,
      });
    } else if (entry.kind === 'phase') {
      points.push({ t: entry.t, kind: 'phase', severity: 'info', label: entry.label });
    } else if (entry.kind === 'vital_change' && entry.label.startsWith(RHYTHM_LOG_PREFIX)) {
      const rhythm = labelToRhythm(entry.label.slice(RHYTHM_LOG_PREFIX.length));
      points.push({
        t: entry.t,
        kind: 'rhythm',
        severity: rhythm && LETHAL_RHYTHMS.has(rhythm) ? 'critical' : 'warning',
        label: entry.label,
      });
    }
  }

  // Alarm crossings, reconstructed from the sampled history. DEFAULT_VITALS
  // pads the keys history doesn't carry (and pins rhythm to sinus, so rhythm
  // alarms can't double-fire here — rhythm points come from the log above).
  const trackers = new Map<string, EscalationTracker>();
  const trackerFor = (vital: string, label: string): EscalationTracker => {
    let tr = trackers.get(vital);
    if (!tr) {
      tr = new EscalationTracker(label, points);
      trackers.set(vital, tr);
    }
    return tr;
  };

  for (const sample of session.history ?? []) {
    const { t, ...vitals } = sample;
    const alarms = evaluateAlarms({ ...DEFAULT_VITALS, ...vitals });
    for (const key of HISTORY_ALARM_KEYS) {
      const { level, message } = alarmLevelFor(alarms, key);
      trackerFor(key, VITAL_META[key].label).observe(t, level, message);
    }
    if (artLine) {
      const { level, message } = alarmLevelFor(alarms, 'sbp');
      trackerFor('sbp', VITAL_META.sbp.label).observe(t, level, message);
    }
  }

  // In cuff mode, BP turning points follow the readings the monitor showed.
  if (!artLine) {
    for (const entry of log) {
      if (entry.kind !== 'vital_change') continue;
      const m = NIBP_LOG_RE.exec(entry.label);
      if (!m) continue;
      const alarms = evaluateAlarms({
        ...DEFAULT_VITALS,
        sbp: Number(m[1]),
        dbp: Number(m[2]),
      });
      const { level, message } = alarmLevelFor(alarms, 'sbp');
      trackerFor('sbp', VITAL_META.sbp.label).observe(entry.t, level, message);
    }
  }

  return points.sort((a, b) => a.t - b.t);
}
