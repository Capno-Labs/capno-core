import { describe, expect, it } from 'vitest';

import { DISPLAY_COPY } from './displayCopy';
import { isDisplaySafe } from './displayType';

describe('display copy', () => {
  it('stays inside the display font subset', () => {
    for (const [key, lines] of Object.entries(DISPLAY_COPY)) {
      for (const line of lines) {
        expect(isDisplaySafe(line), `${key}: "${line}"`).toBe(true);
      }
    }
  });
});
