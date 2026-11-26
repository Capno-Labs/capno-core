'use client';

import type { PreBrief as PreBriefData } from '@/lib/engine/types';
import { airwaySummary, hasAllergy } from '@/lib/patient';

/**
 * What the student display shows before the scenario starts: the patient's
 * pre-operative details, set large enough to read from across the room. It
 * renders only what the snapshot carries — the patient, never the scenario's
 * title or events — and gives way to the monitor when the session starts.
 */
export function PreBrief({ brief }: { brief: PreBriefData }) {
  const { patient } = brief;
  const rows: { label: string; value: string; alert?: boolean }[] = [
    {
      label: 'Allergies',
      value: patient.allergies.length ? patient.allergies.join('; ') : 'No known drug allergies',
      alert: hasAllergy(patient.allergies),
    },
    { label: 'History', value: patient.pmh.join('; ') || 'None recorded' },
    { label: 'Medications', value: patient.medications.join('; ') || 'None' },
    { label: 'Airway exam', value: airwaySummary(patient.airway) },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-monitor-bg p-5 font-mono text-monitor-ink md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-vital-ecg">
            Pre-operative brief
          </p>
          <h1 className="text-[clamp(1.75rem,4.5vw,3.5rem)] font-bold leading-tight">
            {patient.name}
          </h1>
        </div>
        <p className="text-[clamp(1rem,2.2vw,1.75rem)] tabular-nums text-[#dce3d9]">
          {patient.age} y · {patient.sex === 'male' ? 'Male' : 'Female'} · {patient.weightKg} kg ·{' '}
          {patient.heightCm} cm · ASA {patient.asa}
        </p>
      </header>

      <dl className="grid flex-1 content-start gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg bg-monitor-panel p-4 ring-1 ring-monitor-grid">
            <dt className="text-xs font-bold uppercase tracking-wider text-[#8d9688]">{row.label}</dt>
            <dd
              className={`mt-1 text-[clamp(1rem,1.9vw,1.6rem)] leading-snug ${
                row.alert ? 'font-bold text-red-300' : ''
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
        {patient.plan && (
          <div className="rounded-lg bg-monitor-panel p-4 ring-1 ring-monitor-grid md:col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-[#8d9688]">Plan</dt>
            <dd className="mt-1 text-[clamp(1rem,1.9vw,1.6rem)] leading-snug">{patient.plan}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs uppercase tracking-widest text-[#8d9688]">
        Standby — the monitor starts with the scenario
      </p>
    </div>
  );
}
