/**
 * Monitor sound level — the per-device preference behind the speaker button.
 *
 * Two places show a monitor, with different defaults:
 *  - the student **display** defaults to full: it is the room's monitor, and
 *    a silent one loses the pulse tone and alarms the scenario relies on;
 *  - the faculty controller's **preview** defaults to off: it usually sits in
 *    the same room as the display, and two monitors beeping is one too many.
 * They keep separate keys, so one browser running both stays independent.
 *
 * Framework-free; storage is injected so it tests in Node.
 */

export type SoundLevel = 'off' | 'low' | 'full';
export type SoundRole = 'display' | 'preview';

export const SOUND_KEYS: Record<SoundRole, string> = {
  display: 'capno:display-sound:v1',
  preview: 'capno:monitor-sound:v2',
};
/** The old on/off key ('1' | '0'), which both monitors used to share. */
export const LEGACY_SOUND_KEY = 'capno:monitor-sound:v1';

const DEFAULTS: Record<SoundRole, SoundLevel> = { display: 'full', preview: 'off' };

export function defaultSoundLevel(role: SoundRole): SoundLevel {
  return DEFAULTS[role];
}

export function parseSoundLevel(raw: string | null): SoundLevel | null {
  return raw === 'off' || raw === 'low' || raw === 'full' ? raw : null;
}

/** The speaker button cycles off → full → low → off: one tap from silent is
 *  the common wish (sound on), a second tap turns it down. */
export function nextSoundLevel(level: SoundLevel): SoundLevel {
  return level === 'off' ? 'full' : level === 'full' ? 'low' : 'off';
}

/** Master gain for a level. */
export function soundGain(level: SoundLevel): number {
  return level === 'full' ? 1 : level === 'low' ? 0.3 : 0;
}

type SoundStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The stored level for a role, or its default.
 *
 * The preview inherits an old on/off choice once ('1' → full, '0' → off) and
 * then drops the old key. The display does not: the old key was shared, so
 * an "off" there cannot be told apart from the faculty preview's, and a
 * silent room monitor is the worse mistake.
 */
export function readSoundLevel(role: SoundRole, storage: SoundStorage): SoundLevel {
  const stored = parseSoundLevel(storage.getItem(SOUND_KEYS[role]));
  if (stored) return stored;
  if (role === 'preview') {
    const legacy = storage.getItem(LEGACY_SOUND_KEY);
    if (legacy === '1' || legacy === '0') {
      const level: SoundLevel = legacy === '1' ? 'full' : 'off';
      storage.setItem(SOUND_KEYS.preview, level);
      storage.removeItem(LEGACY_SOUND_KEY);
      return level;
    }
  }
  return defaultSoundLevel(role);
}

export function writeSoundLevel(role: SoundRole, level: SoundLevel, storage: SoundStorage): void {
  storage.setItem(SOUND_KEYS[role], level);
}
