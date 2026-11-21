import type { AirwayExam, Patient } from './engine/types';

/**
 * One-line summaries of a scenario patient, shared by the faculty patient
 * card and the student pre-brief so the two never describe the same patient
 * differently.
 */

/** "Alex Doe · 45M · 80 kg · ASA 2" */
export function patientHeadline(patient: Patient): string {
  return `${patient.name} · ${patient.age}${patient.sex === 'male' ? 'M' : 'F'} · ${patient.weightKg} kg · ASA ${patient.asa}`;
}

/** "MP 3 · MO 3 cm · TMD 5 cm · neck limited · …" — only the parts recorded. */
export function airwaySummary(airway: AirwayExam): string {
  return [
    `MP ${airway.mallampati}`,
    airway.mouthOpeningCm !== undefined && `MO ${airway.mouthOpeningCm} cm`,
    airway.thyromentalCm !== undefined && `TMD ${airway.thyromentalCm} cm`,
    airway.neckMobility && `neck ${airway.neckMobility}`,
    airway.dentition,
    airway.notes,
  ]
    .filter(Boolean)
    .join(' · ');
}

const NO_ALLERGY = /^(no known\b.*|nkda|nka|none|nil)\.?$/i;

/**
 * True when the allergy list names an actual allergy. Scenarios often record
 * "No known drug allergies" as an entry, which must not be styled as an alert.
 */
export function hasAllergy(allergies: readonly string[]): boolean {
  return allergies.some((a) => a.trim() !== '' && !NO_ALLERGY.test(a.trim()));
}
