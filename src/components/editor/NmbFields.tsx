'use client';

import type { NeuromuscularBlock, NmbKey } from '@/lib/engine/types';
import { NMB_KEYS, NMB_META } from '@/lib/engine/types';

/**
 * Neuromuscular-block fields, shared by the baseline-vitals editor and the
 * effect editor. As elsewhere in the editor, an empty field is not written:
 *  - `baseline`: a tick box decides whether a twitch monitor is attached from
 *    the start (`nmb` present, even as `{}`); an empty field means no block.
 *  - `effect`: an empty field is left unchanged.
 */
export function NmbFields({
  nmb,
  onChange,
  mode,
}: {
  nmb: Partial<NeuromuscularBlock> | undefined;
  onChange: (next: Partial<NeuromuscularBlock> | undefined) => void;
  mode: 'baseline' | 'effect';
}) {
  const baseline = mode === 'baseline';
  const attached = nmb !== undefined;

  const setField = (key: NmbKey, raw: string) => {
    const next = { ...nmb };
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) delete next[key];
    else {
      const clamped = Math.min(NMB_META[key].max, Math.max(NMB_META[key].min, n));
      // Counts are whole twitches.
      next[key] = key === 'tofRatio' ? clamped : Math.round(clamped);
    }
    // In an effect, nothing left means no `nmb` key at all; in a baseline an
    // empty object still means "attach the twitch monitor".
    onChange(!baseline && Object.keys(next).length === 0 ? undefined : next);
  };

  return (
    <>
      {baseline && (
        <label className="flex cursor-pointer items-center gap-2 self-end text-sm text-ink-2">
          <input
            type="checkbox"
            checked={attached}
            onChange={(e) => onChange(e.target.checked ? {} : undefined)}
          />
          Twitch monitor on the monitor
        </label>
      )}
      {(attached || !baseline) &&
        NMB_KEYS.map((key) => (
          <div key={key}>
            <span className="label">
              {NMB_META[key].label} ({NMB_META[key].unit})
            </span>
            <input
              className="input w-24"
              type="number"
              min={NMB_META[key].min}
              max={NMB_META[key].max}
              step={NMB_META[key].step}
              placeholder={baseline ? 'no block' : 'unchanged'}
              value={nmb?.[key] ?? ''}
              onChange={(e) => setField(key, e.target.value)}
              title={
                key === 'tofRatio'
                  ? 'Read only while the count is 4'
                  : key === 'ptc'
                    ? 'Read only while the count is 0'
                    : undefined
              }
            />
          </div>
        ))}
    </>
  );
}
