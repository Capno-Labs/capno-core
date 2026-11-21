'use client';

import type { AnestheticAgent, VentKey, Ventilation } from '@/lib/engine/types';
import { AGENT_LABELS, VENT_KEYS, VENT_META } from '@/lib/engine/types';

/**
 * Anesthesia-machine fields, shared by the baseline-vitals editor and the
 * effect editor. As elsewhere in the editor, an empty field is not written:
 *  - `baseline`: a tick box decides whether the monitor shows the machine
 *    tiles from the start (`vent` present, even as `{}`); an empty reading
 *    takes the default for the patient. Sevoflurane, the default agent, is
 *    never stored.
 *  - `effect`: an empty reading is left unchanged, as is an unset agent.
 */
export function VentFields({
  vent,
  agent,
  onChange,
  mode,
}: {
  vent: Partial<Ventilation> | undefined;
  agent: AnestheticAgent | undefined;
  onChange: (next: { vent: Partial<Ventilation> | undefined; agent: AnestheticAgent | undefined }) => void;
  mode: 'baseline' | 'effect';
}) {
  const baseline = mode === 'baseline';
  const shown = vent !== undefined;

  const setReading = (key: VentKey, raw: string) => {
    const next = { ...vent };
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) delete next[key];
    else next[key] = Math.min(VENT_META[key].max, Math.max(VENT_META[key].min, n));
    // In an effect, no readings left means no `vent` key at all; in a
    // baseline an empty object still means "show the tiles".
    onChange({ vent: !baseline && Object.keys(next).length === 0 ? undefined : next, agent });
  };

  return (
    <>
      {baseline && (
        <label className="flex cursor-pointer items-center gap-2 self-end text-sm text-ink-2">
          <input
            type="checkbox"
            checked={shown}
            onChange={(e) => onChange({ vent: e.target.checked ? {} : undefined, agent })}
          />
          Machine readings on the monitor
        </label>
      )}
      {(shown || !baseline) &&
        VENT_KEYS.map((key) => (
          <div key={key}>
            <span className="label">
              {VENT_META[key].label} ({VENT_META[key].unit})
            </span>
            <input
              className="input w-24"
              type="number"
              min={VENT_META[key].min}
              max={VENT_META[key].max}
              step={VENT_META[key].step}
              placeholder={baseline ? 'default' : 'unchanged'}
              value={vent?.[key] ?? ''}
              onChange={(e) => setReading(key, e.target.value)}
            />
          </div>
        ))}
      <div>
        <span className="label">Agent</span>
        <select
          className="input w-auto"
          value={baseline && agent === 'sevoflurane' ? '' : (agent ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            const next = raw === '' || (baseline && raw === 'sevoflurane') ? undefined : (raw as AnestheticAgent);
            onChange({ vent, agent: next });
          }}
        >
          <option value="">{baseline ? `${AGENT_LABELS.sevoflurane} — default` : '— unchanged —'}</option>
          {(Object.keys(AGENT_LABELS) as AnestheticAgent[])
            .filter((a) => !baseline || a !== 'sevoflurane')
            .map((a) => (
              <option key={a} value={a}>
                {AGENT_LABELS[a]}
              </option>
            ))}
        </select>
      </div>
    </>
  );
}
