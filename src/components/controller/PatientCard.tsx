'use client';

import type { Patient } from '@/lib/engine/types';
import { airwaySummary, hasAllergy, patientHeadline } from '@/lib/patient';

/**
 * Patient background for quick faculty reference, shown in the run dock's
 * Log | Patient card. Always open: the dock's tab is the disclosure.
 */
export function PatientDetails({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-2 overflow-y-auto fit:min-h-0 fit:flex-1 fit:overscroll-contain">
      <h3 className="text-sm font-bold text-ink">{patientHeadline(patient)}</h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="label">PMH</dt>
          <dd className="text-ink-2">{patient.pmh.join('; ') || '—'}</dd>
        </div>
        <div>
          <dt className="label">Medications</dt>
          <dd className="text-ink-2">{patient.medications.join('; ') || '—'}</dd>
        </div>
        <div>
          <dt className="label">Allergies</dt>
          <dd className={hasAllergy(patient.allergies) ? 'text-red' : 'text-ink-2'}>
            {patient.allergies.join('; ') || 'NKDA'}
          </dd>
        </div>
        <div>
          <dt className="label">Airway exam</dt>
          <dd className="text-ink-2">{airwaySummary(patient.airway)}</dd>
        </div>
        {patient.plan && (
          <div className="sm:col-span-2">
            <dt className="label">Plan</dt>
            <dd className="text-ink-2">{patient.plan}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
