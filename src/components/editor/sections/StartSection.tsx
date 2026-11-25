'use client';

import { Disclosure } from '@/components/ui/Disclosure';
import { TimeField } from '@/components/ui/TimeField';
import type { MonitoringConfig, Scenario } from '@/lib/engine/types';
import { AlarmLimitsEditor } from '../AlarmLimitsEditor';
import { BaselineVitalsEditor } from '../BaselineVitalsEditor';
import { StartPreview } from '../StartPreview';
import { SectionCard, SectionHead } from './SectionHead';

/** How the patient and the monitor look at time zero. */
export function StartSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  // `monitoring` is absent (not {}) when nothing in it is set — export
  // parity with the hand-written bundled scenarios.
  const updateMonitoring = (patch: Partial<MonitoringConfig>) => {
    const monitoring: MonitoringConfig = { ...scenario.monitoring, ...patch };
    for (const key of Object.keys(monitoring) as (keyof MonitoringConfig)[]) {
      if (monitoring[key] === undefined) delete monitoring[key];
    }
    update({ monitoring: Object.keys(monitoring).length > 0 ? monitoring : undefined });
  };

  const monitoring = scenario.monitoring;
  const artLine = monitoring?.artLine === true;
  const alarmsChanged =
    monitoring?.alarmProfile !== undefined ||
    monitoring?.alarmLimits !== undefined ||
    (monitoring?.alarmsOff?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <SectionHead title="Starting state">
        The patient when the case starts. Everything in Progression moves away from, and back
        to, these numbers.
      </SectionHead>

      <StartPreview vitals={scenario.baselineVitals} monitoring={monitoring} />

      <SectionCard title="Starting vitals">
        <BaselineVitalsEditor
          vitals={scenario.baselineVitals}
          onChange={(baselineVitals) => update({ baselineVitals })}
        />
      </SectionCard>

      <SectionCard title="Monitoring">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={artLine}
            onChange={(e) => updateMonitoring({ artLine: e.target.checked ? true : undefined })}
          />
          Arterial line: blood pressure displays continuously
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={monitoring?.v5 === true}
            onChange={(e) => updateMonitoring({ v5: e.target.checked ? true : undefined })}
          />
          V5 lead: a second ECG trace under lead II, with its own ST level
        </label>
        {!artLine && (
          <TimeField
            className="max-w-[14rem]"
            label="Cuff cycles every"
            valueSec={monitoring?.nibpIntervalSec}
            minSec={15}
            maxSec={1800}
            placeholder="3:00"
            hint="Blank uses 3:00. Between cycles the monitor shows the last reading, which is often the teaching point."
            onChange={(nibpIntervalSec) => updateMonitoring({ nibpIntervalSec })}
          />
        )}
        <Disclosure title="Alarm limits" summary={alarmsChanged ? 'Changed' : 'Standard for the patient category'}>
          <AlarmLimitsEditor monitoring={monitoring} onChange={updateMonitoring} />
        </Disclosure>
      </SectionCard>
    </div>
  );
}
