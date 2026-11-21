import { describe, expect, it } from 'vitest';
import { airwaySummary, hasAllergy, patientHeadline } from './patient';
import type { Patient } from './engine/types';

const patient: Patient = {
  name: 'Alex Doe',
  age: 45,
  sex: 'male',
  weightKg: 80,
  heightCm: 178,
  asa: 2,
  allergies: [],
  medications: [],
  pmh: [],
  airway: { mallampati: 2 },
};

describe('patient summaries', () => {
  it('writes the headline', () => {
    expect(patientHeadline(patient)).toBe('Alex Doe · 45M · 80 kg · ASA 2');
    expect(patientHeadline({ ...patient, sex: 'female', age: 31 })).toBe('Alex Doe · 31F · 80 kg · ASA 2');
  });

  it('lists only the airway findings that were recorded', () => {
    expect(airwaySummary({ mallampati: 2 })).toBe('MP 2');
    expect(
      airwaySummary({
        mallampati: 4,
        mouthOpeningCm: 2.5,
        thyromentalCm: 5,
        neckMobility: 'limited',
        dentition: 'prominent incisors',
        notes: 'short neck',
      }),
    ).toBe('MP 4 · MO 2.5 cm · TMD 5 cm · neck limited · prominent incisors · short neck');
  });

  it('tells a real allergy from a statement that there are none', () => {
    expect(hasAllergy([])).toBe(false);
    for (const none of ['No known drug allergies', 'NKDA', 'nkda', 'None', 'No known allergies.']) {
      expect(hasAllergy([none])).toBe(false);
    }
    expect(hasAllergy(['Sulfa antibiotics (rash)'])).toBe(true);
    expect(hasAllergy(['Seasonal pollen (rhinitis)', 'No known drug allergies'])).toBe(true);
    expect(hasAllergy(['Penicillin — no known reaction type'])).toBe(true);
  });
});
