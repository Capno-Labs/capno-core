'use client';

import type { AlarmState, SimSnapshot } from '@/lib/engine/types';
import { map, RHYTHM_LABELS } from '@/lib/engine/types';
import { formatClock } from '@/lib/format';

/**
 * At-a-glance triage panel for the faculty controller: one graded row per
 * body system, derived entirely from `snapshot.alarms`. The engine evaluates
 * those alarms against the last cuff reading in NIBP mode (engine.snapshot),
 * so this panel always agrees with the monitor's alarm banner — never
 * re-evaluate alarm limits here. Faculty-only; the student monitor must not
 * render it.
 */

type SystemVital = AlarmState['vital'];

/** UI grouping of alarmed vitals into systems — display taxonomy, not clinical content. */
const SYSTEMS: { id: string; label: string; vitals: SystemVital[] }[] = [
  { id: 'hemodynamics', label: 'Hemodynamics', vitals: ['hr', 'sbp', 'dbp', 'rhythm'] },
  { id: 'oxygenation', label: 'Oxygenation', vitals: ['spo2'] },
  { id: 'ventilation', label: 'Ventilation', vitals: ['etco2', 'rr'] },
  { id: 'temperature', label: 'Temperature', vitals: ['temp'] },
];

type Grade = 'ok' | 'caution' | 'alert';

const GRADE_META: Record<Grade, { label: string; row: string; chip: string }> = {
  ok: {
    label: 'OK',
    row: 'ring-1 ring-slate-800',
    chip: 'text-emerald-400',
  },
  caution: {
    label: 'Caution',
    row: 'bg-yellow-950/40 ring-1 ring-yellow-500/70',
    chip: 'text-yellow-300',
  },
  alert: {
    label: 'Alert',
    row: 'bg-red-950/60 ring-1 ring-red-500',
    chip: 'text-red-300',
  },
};

function grade(alarms: AlarmState[]): Grade {
  if (alarms.some((a) => a.level === 'critical')) return 'alert';
  if (alarms.length > 0) return 'caution';
  return 'ok';
}

export function StateSummary({ snapshot }: { snapshot: SimSnapshot }) {
  const v = snapshot.vitals;
  // Same BP source as the monitor: last cuff reading (with its age) in NIBP
  // mode, live pressure only with an arterial line.
  const cuff = snapshot.nibp;
  const bp = cuff
    ? `BP ${cuff.sbp}/${cuff.dbp} (${formatClock(Math.max(0, snapshot.elapsedSec - cuff.atSec))} ago)`
    : `BP ${Math.round(v.sbp)}/${Math.round(v.dbp)} · MAP ${map(v)}`;

  const quietDetail: Record<string, string> = {
    hemodynamics: `HR ${Math.round(v.hr)} · ${RHYTHM_LABELS[v.rhythm]} · ${bp}`,
    oxygenation: `SpO₂ ${Math.round(v.spo2)}%`,
    ventilation: `EtCO₂ ${Math.round(v.etco2)} · RR ${Math.round(v.rr)}`,
    temperature: `${v.temp.toFixed(1)} °C`,
  };

  const rows = SYSTEMS.map((sys) => ({
    id: sys.id,
    label: sys.label,
    alarms: snapshot.alarms.filter((a) => sys.vitals.includes(a.vital)),
  }));
  // Catch-all so the panel can never disagree with the alarm banner: an
  // alarm vital no system claims (possible if ALARM_LIMITS grows) still
  // surfaces here instead of silently reading all-OK.
  const grouped = new Set<SystemVital>(SYSTEMS.flatMap((s) => s.vitals));
  const other = snapshot.alarms.filter((a) => !grouped.has(a.vital));
  if (other.length > 0) rows.push({ id: 'other', label: 'Other', alarms: other });

  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Patient state
        </h2>
        {snapshot.alarmsSilenced && (
          <span className="text-xs text-slate-500">🔕 silenced</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const g = grade(row.alarms);
          const meta = GRADE_META[g];
          const detail = row.alarms.length
            ? row.alarms.map((a) => a.message).join(' · ')
            : quietDetail[row.id];
          return (
            <li
              key={row.id}
              className={`flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 ${meta.row}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-300">{row.label}</p>
                <p className={`truncate font-mono text-xs ${g === 'ok' ? 'text-slate-500' : meta.chip}`}>
                  {detail}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-bold uppercase tracking-wider ${meta.chip}`}>
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
