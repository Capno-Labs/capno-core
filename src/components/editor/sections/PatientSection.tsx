'use client';

import { Field } from '@/components/ui/Field';
import { NumberField } from '@/components/ui/NumberField';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import type { AirwayExam, Scenario } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';
import { SectionCard, SectionHead } from './SectionHead';

type Patient = Scenario['patient'];

const SEX_OPTIONS: SelectOption<Patient['sex']>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
const ASA_OPTIONS: SelectOption<string>[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `ASA ${n}`,
}));
const MALLAMPATI_OPTIONS: SelectOption<string>[] = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: `Class ${n}`,
}));
const NECK_OPTIONS: SelectOption<NonNullable<AirwayExam['neckMobility']>>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'limited', label: 'Limited' },
  { value: 'immobile', label: 'Immobile' },
];

export function PatientSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  const { patient } = scenario;
  const updatePatient = (patch: Partial<Patient>) => update({ patient: { ...patient, ...patch } });

  // Optional airway fields follow the editor-wide convention: blank input
  // deletes the key (export parity with the hand-written bundled scenarios).
  const updateAirway = (patch: Partial<AirwayExam>) => {
    const airway: AirwayExam = { ...patient.airway, ...patch };
    for (const key of Object.keys(airway) as (keyof AirwayExam)[]) {
      if (airway[key] === undefined) delete airway[key];
    }
    updatePatient({ airway });
  };

  const optionalText = (raw: string) => (raw === '' ? undefined : raw);

  return (
    <div className="space-y-4">
      <SectionHead title="Patient">
        Who is on the table. Faculty can show this page to learners before the case starts, so
        keep faculty-only notes out of it.
      </SectionHead>

      <SectionCard title="Who">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field className="col-span-2" label="Name">
            <input className="input" value={patient.name} onChange={(e) => updatePatient({ name: e.target.value })} />
          </Field>
          <NumberField
            label="Age"
            unit="years"
            value={patient.age}
            min={0}
            max={120}
            integer
            required
            onChange={(age) => age !== undefined && updatePatient({ age })}
          />
          <SelectField
            label="Sex"
            value={patient.sex}
            options={SEX_OPTIONS}
            onChange={(sex) => sex && updatePatient({ sex })}
          />
          <NumberField
            label="Weight"
            unit="kg"
            value={patient.weightKg}
            min={0.3}
            max={400}
            step={1}
            required
            onChange={(weightKg) => weightKg !== undefined && updatePatient({ weightKg })}
          />
          <NumberField
            label="Height"
            unit="cm"
            value={patient.heightCm}
            min={20}
            max={250}
            step={1}
            required
            onChange={(heightCm) => heightCm !== undefined && updatePatient({ heightCm })}
          />
          <SelectField
            label="ASA class"
            value={String(patient.asa)}
            options={ASA_OPTIONS}
            onChange={(asa) => asa && updatePatient({ asa: Number(asa) as Patient['asa'] })}
          />
        </div>
        <Field
          label="Surgical and anesthetic plan"
          hint="Optional. For example: laparoscopic cholecystectomy under general anesthesia with an endotracheal tube."
        >
          <textarea
            className="input"
            rows={2}
            value={patient.plan ?? ''}
            onChange={(e) => updatePatient({ plan: optionalText(e.target.value) })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Airway exam" hint="Only Mallampati is required; leave the rest blank if it was not examined.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Mallampati"
            value={String(patient.airway.mallampati)}
            options={MALLAMPATI_OPTIONS}
            onChange={(m) => m && updateAirway({ mallampati: Number(m) as AirwayExam['mallampati'] })}
          />
          <NumberField
            label="Mouth opening"
            unit="cm"
            value={patient.airway.mouthOpeningCm}
            min={0}
            max={10}
            step={0.5}
            onChange={(mouthOpeningCm) => updateAirway({ mouthOpeningCm })}
          />
          <NumberField
            label="Thyromental distance"
            unit="cm"
            value={patient.airway.thyromentalCm}
            min={0}
            max={15}
            step={0.5}
            onChange={(thyromentalCm) => updateAirway({ thyromentalCm })}
          />
          <SelectField
            label="Neck mobility"
            value={patient.airway.neckMobility}
            options={NECK_OPTIONS}
            emptyLabel="Not recorded"
            onChange={(neckMobility) => updateAirway({ neckMobility })}
          />
          <Field className="col-span-2" label="Dentition" hint="For example: loose upper incisor, full dentures.">
            <input
              className="input"
              value={patient.airway.dentition ?? ''}
              onChange={(e) => updateAirway({ dentition: optionalText(e.target.value) })}
            />
          </Field>
          <Field className="col-span-2" label="Airway notes">
            <input
              className="input"
              value={patient.airway.notes ?? ''}
              onChange={(e) => updateAirway({ notes: optionalText(e.target.value) })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="History">
        <ListEditor label="Allergies" ordered={false} items={patient.allergies} onChange={(allergies) => updatePatient({ allergies })} placeholder="Add an allergy…" />
        <ListEditor label="Medications" ordered={false} items={patient.medications} onChange={(medications) => updatePatient({ medications })} placeholder="Add a medication…" />
        <ListEditor label="Past medical history" ordered={false} items={patient.pmh} onChange={(pmh) => updatePatient({ pmh })} placeholder="Add a condition…" />
      </SectionCard>
    </div>
  );
}
