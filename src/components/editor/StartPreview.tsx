import type { MonitoringConfig, Vitals } from '@/lib/engine/types';
import { RHYTHM_LABELS, hasPulse } from '@/lib/engine/types';

/**
 * The numbers learners will see when the case starts, laid out like the
 * monitor and always dark like it. A static preview of the values as typed:
 * no waveforms, and none of the live monitor's measuring behaviour (the cuff
 * cycle, the counted heart rate) — those belong to a running session.
 */
export function StartPreview({
  vitals,
  monitoring,
}: {
  vitals: Vitals;
  monitoring: MonitoringConfig | undefined;
}) {
  const pulse = hasPulse(vitals);
  const tiles: { label: string; unit: string; value: string; tone: string; note?: string }[] = [
    { label: 'HR', unit: 'bpm', value: String(vitals.hr), tone: 'text-vital-ecg', note: RHYTHM_LABELS[vitals.rhythm] },
    { label: 'SpO₂', unit: '%', value: pulse ? String(vitals.spo2) : '--', tone: 'text-vital-spo2' },
    {
      label: monitoring?.artLine ? 'ART' : 'NIBP',
      unit: 'mmHg',
      value: `${vitals.sbp}/${vitals.dbp}`,
      tone: 'text-vital-nibp',
      note: monitoring?.artLine ? 'Continuous' : 'Cuff',
    },
    { label: 'EtCO₂', unit: 'mmHg', value: String(vitals.etco2), tone: 'text-vital-etco2', note: `RR ${vitals.rr}` },
    { label: 'Temp', unit: '°C', value: vitals.temp.toFixed(1), tone: 'text-vital-temp' },
  ];
  return (
    <figure className="rounded-card bg-monitor-bg p-3 ring-1 ring-monitor-grid">
      <figcaption className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-monitor-ink/60">
        Monitor at the start
      </figcaption>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-ctl bg-monitor-panel px-3 py-2">
            <div className={`font-mono text-[10px] uppercase tracking-wider ${t.tone}`}>
              {t.label} <span className="text-monitor-ink/50">{t.unit}</span>
            </div>
            <div className={`font-mono text-2xl font-semibold tabular-nums leading-tight ${t.tone}`}>
              {t.value}
            </div>
            <div className="h-3.5 truncate font-mono text-[10px] text-monitor-ink/60">{t.note}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}
