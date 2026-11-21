import { describe, expect, it } from 'vitest';

import { isDisplaySafe } from './displayType';

describe('isDisplaySafe', () => {
  it('accepts authored headlines inside the font subset', () => {
    for (const ok of ['Run the case.', "Debrief while it's fresh.", 'What are you teaching?', 'Step 01 / 03', 'You’re in.']) {
      expect(isDisplaySafe(ok)).toBe(true);
    }
  });

  it('rejects glyphs the subset lacks, so user data never renders in the display face', () => {
    for (const bad of ['EtCO₂ rising', 'ana@example.org', 'Señora', 'A + B', 'Case “one”', '']) {
      expect(isDisplaySafe(bad)).toBe(false);
    }
  });
});
