import { describe, expect, it } from 'vitest';
import {
  defaultSoundLevel,
  LEGACY_SOUND_KEY,
  nextSoundLevel,
  parseSoundLevel,
  readSoundLevel,
  SOUND_KEYS,
  soundGain,
  writeSoundLevel,
} from './soundPref';

/** Minimal in-memory stand-in for localStorage. */
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('sound level preference', () => {
  it('defaults the student display to full and the faculty preview to off', () => {
    expect(defaultSoundLevel('display')).toBe('full');
    expect(defaultSoundLevel('preview')).toBe('off');
    expect(readSoundLevel('display', storage())).toBe('full');
    expect(readSoundLevel('preview', storage())).toBe('off');
  });

  it('keeps the two monitors independent in one browser', () => {
    const s = storage();
    writeSoundLevel('display', 'low', s);
    writeSoundLevel('preview', 'full', s);
    expect(readSoundLevel('display', s)).toBe('low');
    expect(readSoundLevel('preview', s)).toBe('full');
    expect(SOUND_KEYS.display).not.toBe(SOUND_KEYS.preview);
  });

  it('cycles off → full → low → off', () => {
    expect(nextSoundLevel('off')).toBe('full');
    expect(nextSoundLevel('full')).toBe('low');
    expect(nextSoundLevel('low')).toBe('off');
  });

  it('plays quieter at low and nothing at off', () => {
    expect(soundGain('full')).toBe(1);
    expect(soundGain('low')).toBeGreaterThan(0);
    expect(soundGain('low')).toBeLessThan(0.5);
    expect(soundGain('off')).toBe(0);
  });

  it('ignores anything that is not a level', () => {
    for (const raw of [null, '', '1', '0', 'on', 'FULL']) expect(parseSoundLevel(raw)).toBeNull();
    expect(readSoundLevel('display', storage({ [SOUND_KEYS.display]: 'loud' }))).toBe('full');
  });

  describe('the old shared on/off key', () => {
    it('carries over to the faculty preview once, then is dropped', () => {
      const on = storage({ [LEGACY_SOUND_KEY]: '1' });
      expect(readSoundLevel('preview', on)).toBe('full');
      expect(on.data.get(SOUND_KEYS.preview)).toBe('full');
      expect(on.data.has(LEGACY_SOUND_KEY)).toBe(false);

      const off = storage({ [LEGACY_SOUND_KEY]: '0' });
      expect(readSoundLevel('preview', off)).toBe('off');
      expect(off.data.get(SOUND_KEYS.preview)).toBe('off');
    });

    it('never overrides a level already chosen with the new key', () => {
      const s = storage({ [LEGACY_SOUND_KEY]: '1', [SOUND_KEYS.preview]: 'low' });
      expect(readSoundLevel('preview', s)).toBe('low');
      expect(s.data.get(LEGACY_SOUND_KEY)).toBe('1'); // left alone
    });

    it('does not silence the student display', () => {
      const s = storage({ [LEGACY_SOUND_KEY]: '0' });
      expect(readSoundLevel('display', s)).toBe('full');
      // …and reading the display leaves the old key for the preview to inherit.
      expect(s.data.get(LEGACY_SOUND_KEY)).toBe('0');
      expect(readSoundLevel('preview', s)).toBe('off');
    });
  });
});
