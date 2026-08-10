'use client';

import type { MonitoringConfig, Scenario } from '@/lib/engine/types';
import { BaselineVitalsEditor } from '../BaselineVitalsEditor';

export function VitalsSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  // `monitoring` is absent (not {}) when both fields are unset — export
  // parity with the hand-written bundled scenarios.
  const updateMonitoring = (patch: Partial<MonitoringConfig>) => {
    const monitoring: MonitoringConfig = { ...scenario.monitoring, ...patch };
    for (const key of Object.keys(monitoring) as (keyof MonitoringConfig)[]) {
      if (monitoring[key] === undefined) delete monitoring[key];
    }
    update({ monitoring: Object.keys(monitoring).length > 0 ? monitoring : undefined });
  };

  const artLine = scenario.monitoring?.artLine === true;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Baseline vitals
        </h2>
        <p className="text-xs text-slate-500">
          The patient’s state when the case starts. Events ramp vitals away from (and back to)
          these numbers.
        </p>
        <BaselineVitalsEditor
          vitals={scenario.baselineVitals}
          onChange={(baselineVitals) => update({ baselineVitals })}
        />
      </section>
      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          BP monitoring
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={artLine}
            onChange={(e) => updateMonitoring({ artLine: e.target.checked ? true : undefined })}
          />
          Arterial line — BP displays continuously
        </label>
        <div className="flex items-end gap-3">
          <div>
            <span className="label">NIBP cuff interval (s)</span>
            <input
              className="input w-32"
              type="number"
              min={15}
              max={1800}
              placeholder="180 (default)"
              disabled={artLine}
              value={scenario.monitoring?.nibpIntervalSec ?? ''}
              onChange={(e) =>
                updateMonitoring({
                  nibpIntervalSec: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Without an arterial line, the monitor shows the last cuff reading — it only updates when
          the cuff cycles. The staleness between readings is often the teaching point.
        </p>
      </section>
    </div>
  );
}
