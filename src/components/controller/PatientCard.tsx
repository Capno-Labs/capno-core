'use client';

import { useState } from 'react';
import type { Patient } from '@/lib/engine/types';

/** Collapsible patient background summary for quick faculty reference. */
export function PatientCard({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-bold text-slate-200">
            {patient.name} · {patient.age}
            {patient.sex === 'male' ? 'M' : 'F'} · {patient.weightKg} kg · ASA {patient.asa}
          </h2>
          {!open && (
            <p className="text-xs text-slate-500">
              Allergies: {patient.allergies.length ? patient.allergies.join(', ') : 'NKDA'} · tap
              for details
            </p>
          )}
        </div>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="label">PMH</dt>
            <dd className="text-slate-300">{patient.pmh.join('; ') || '—'}</dd>
          </div>
          <div>
            <dt className="label">Medications</dt>
            <dd className="text-slate-300">{patient.medications.join('; ') || '—'}</dd>
          </div>
          <div>
            <dt className="label">Allergies</dt>
            <dd className={patient.allergies.length ? 'text-red-300' : 'text-slate-300'}>
              {patient.allergies.join('; ') || 'NKDA'}
            </dd>
          </div>
          <div>
            <dt className="label">Airway exam</dt>
            <dd className="text-slate-300">
              MP {patient.airway.mallampati}
              {patient.airway.mouthOpeningCm && ` · MO ${patient.airway.mouthOpeningCm} cm`}
              {patient.airway.thyromentalCm && ` · TMD ${patient.airway.thyromentalCm} cm`}
              {patient.airway.neckMobility && ` · neck ${patient.airway.neckMobility}`}
              {patient.airway.dentition && ` · ${patient.airway.dentition}`}
              {patient.airway.notes && ` · ${patient.airway.notes}`}
            </dd>
          </div>
          {patient.plan && (
            <div className="sm:col-span-2">
              <dt className="label">Plan</dt>
              <dd className="text-slate-300">{patient.plan}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
