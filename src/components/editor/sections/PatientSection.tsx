'use client';

import type { AirwayExam, Scenario } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';

export function PatientSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  const updatePatient = (patch: Partial<Scenario['patient']>) =>
    update({ patient: { ...scenario.patient, ...patch } });

  // Optional airway fields follow the editor-wide convention: blank input
  // deletes the key (export parity with the hand-written bundled scenarios).
  const updateAirway = (patch: Partial<AirwayExam>) => {
    const airway: AirwayExam = { ...scenario.patient.airway, ...patch };
    for (const key of Object.keys(airway) as (keyof AirwayExam)[]) {
      if (airway[key] === undefined) delete airway[key];
    }
    updatePatient({ airway });
  };

  const optionalNum = (raw: string) => (raw === '' ? undefined : Number(raw));
  const optionalText = (raw: string) => (raw === '' ? undefined : raw);

  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Patient</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <span className="label">Name</span>
          <input className="input" value={scenario.patient.name} onChange={(e) => updatePatient({ name: e.target.value })} />
        </div>
        <div>
          <span className="label">Age</span>
          <input className="input" type="number" value={scenario.patient.age} onChange={(e) => updatePatient({ age: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <span className="label">Sex</span>
          <select className="input" value={scenario.patient.sex} onChange={(e) => updatePatient({ sex: e.target.value as 'male' | 'female' })}>
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
        </div>
        <div>
          <span className="label">Weight kg</span>
          <input className="input" type="number" value={scenario.patient.weightKg} onChange={(e) => updatePatient({ weightKg: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <span className="label">Height cm</span>
          <input className="input" type="number" value={scenario.patient.heightCm} onChange={(e) => updatePatient({ heightCm: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <span className="label">ASA</span>
          <select className="input" value={scenario.patient.asa} onChange={(e) => updatePatient({ asa: Number(e.target.value) as Scenario['patient']['asa'] })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Surgical / anesthetic plan (shown to learners at case start)</span>
        <textarea
          className="input"
          rows={2}
          placeholder="optional — e.g. laparoscopic cholecystectomy under GA with ETT"
          value={scenario.patient.plan ?? ''}
          onChange={(e) => updatePatient({ plan: optionalText(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <span className="label">Airway exam</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <span className="label">Mallampati</span>
            <select
              className="input"
              value={scenario.patient.airway.mallampati}
              onChange={(e) => updateAirway({ mallampati: Number(e.target.value) as 1 | 2 | 3 | 4 })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Mouth opening (cm)</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              placeholder="optional"
              value={scenario.patient.airway.mouthOpeningCm ?? ''}
              onChange={(e) => updateAirway({ mouthOpeningCm: optionalNum(e.target.value) })}
            />
          </div>
          <div>
            <span className="label">Thyromental (cm)</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              placeholder="optional"
              value={scenario.patient.airway.thyromentalCm ?? ''}
              onChange={(e) => updateAirway({ thyromentalCm: optionalNum(e.target.value) })}
            />
          </div>
          <div>
            <span className="label">Neck mobility</span>
            <select
              className="input"
              value={scenario.patient.airway.neckMobility ?? ''}
              onChange={(e) =>
                updateAirway({
                  neckMobility:
                    e.target.value === '' ? undefined : (e.target.value as AirwayExam['neckMobility']),
                })
              }
            >
              <option value="">— not recorded —</option>
              <option value="normal">normal</option>
              <option value="limited">limited</option>
              <option value="immobile">immobile</option>
            </select>
          </div>
          <div className="col-span-2">
            <span className="label">Dentition</span>
            <input
              className="input"
              placeholder="optional — e.g. loose upper incisor, full dentures"
              value={scenario.patient.airway.dentition ?? ''}
              onChange={(e) => updateAirway({ dentition: optionalText(e.target.value) })}
            />
          </div>
          <div className="col-span-2">
            <span className="label">Airway notes</span>
            <input
              className="input"
              placeholder="optional"
              value={scenario.patient.airway.notes ?? ''}
              onChange={(e) => updateAirway({ notes: optionalText(e.target.value) })}
            />
          </div>
        </div>
      </div>
      <ListEditor label="Allergies" items={scenario.patient.allergies} onChange={(allergies) => updatePatient({ allergies })} />
      <ListEditor label="Medications" items={scenario.patient.medications} onChange={(medications) => updatePatient({ medications })} />
      <ListEditor label="Past medical history" items={scenario.patient.pmh} onChange={(pmh) => updatePatient({ pmh })} />
    </section>
  );
}
