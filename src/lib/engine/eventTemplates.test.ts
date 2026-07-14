import { describe, expect, it } from 'vitest';
import { EVENT_TEMPLATES } from './eventTemplates';
import { DOMAINS } from './lint';
import { vitalEffectSchema } from './schema';
import { NUMERIC_VITAL_KEYS } from './types';
import { clampVital } from './vitals';

const CATEGORIES = [
  'physiology',
  'airway',
  'circulation',
  'drug',
  'equipment',
  'surgical',
  'resolution',
  'other',
];

describe('event templates', () => {
  it('have unique tpl- ids', () => {
    const ids = EVENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^tpl-[a-z0-9][a-z0-9_-]*$/);
  });

  it('use valid categories and curriculum domains', () => {
    for (const t of EVENT_TEMPLATES) {
      expect(CATEGORIES, t.id).toContain(t.category);
      expect(DOMAINS, t.id).toContain(t.domain);
    }
  });

  it('carry effects that validate and stay in vital range', () => {
    for (const t of EVENT_TEMPLATES) {
      for (const effect of t.effects) {
        expect(vitalEffectSchema.safeParse(effect).success, `${t.id}`).toBe(true);
        for (const key of NUMERIC_VITAL_KEYS) {
          const v = effect.vitals?.[key];
          if (v === undefined) continue;
          // In-range targets survive clamping unchanged.
          expect(clampVital(key, v), `${t.id}.${key}`).toBe(v);
        }
      }
    }
  });

  it('cite a bundled-scenario source (clinical provenance)', () => {
    for (const t of EVENT_TEMPLATES) {
      expect(t.source, t.id).toMatch(/^[a-z0-9-]+ › [a-z0-9-]+$/);
    }
  });

  it('marker templates have no effects; others have at least one', () => {
    for (const t of EVENT_TEMPLATES) {
      if (t.kind === 'marker') expect(t.effects, t.id).toEqual([]);
      else expect(t.effects.length, t.id).toBeGreaterThan(0);
    }
  });
});
