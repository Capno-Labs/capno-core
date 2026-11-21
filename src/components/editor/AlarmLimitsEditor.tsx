'use client';

import { useState } from 'react';
import type {
  AlarmBandKey,
  AlarmLimitOverrides,
  AlarmProfile,
  AlarmVital,
  MonitoringConfig,
} from '@/lib/engine/types';
import { ALARM_BAND_KEYS, ALARM_PROFILE_LABELS, ALARM_VITALS } from '@/lib/engine/types';
import { ALARM_PROFILES, alarmLimitProblems, resolveAlarmLimits, VITAL_META } from '@/lib/engine/vitals';

const BAND_LABELS: Record<AlarmBandKey, string> = {
  critLow: 'Critical low',
  warnLow: 'Low',
  warnHigh: 'High',
  critHigh: 'Critical high',
};

/**
 * One limit's box. It keeps what is being typed to itself and commits on
 * leaving the box or Enter, so a half-typed "3" or "of" is not read as a
 * limit.
 */
function LimitInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (raw: string) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className="input w-20"
      inputMode="decimal"
      placeholder={placeholder}
      value={text ?? value}
      onFocus={() => setText(value)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null && text !== value) onCommit(text);
        setText(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      aria-label={label}
    />
  );
}

/**
 * The monitor's alarm limits for a case: a patient category to start from,
 * and any limits this case changes. An empty box keeps the profile's limit
 * (shown as the placeholder), a number replaces it, and "off" switches that
 * limit off. Only changes are written to the scenario.
 */
export function AlarmLimitsEditor({
  monitoring,
  onChange,
}: {
  monitoring: MonitoringConfig | undefined;
  onChange: (patch: Pick<MonitoringConfig, 'alarmProfile' | 'alarmLimits'>) => void;
}) {
  const profile = monitoring?.alarmProfile ?? 'adult';
  const overrides = monitoring?.alarmLimits;
  const base = ALARM_PROFILES[profile];
  const problems = alarmLimitProblems(resolveAlarmLimits(monitoring));

  const setLimit = (vital: AlarmVital, key: AlarmBandKey, raw: string) => {
    const text = raw.trim().toLowerCase();
    const next: AlarmLimitOverrides = { ...overrides, [vital]: { ...overrides?.[vital] } };
    const band = next[vital]!;
    const n = Number(text);
    if (text === 'off') band[key] = null;
    else if (text === '' || !Number.isFinite(n)) delete band[key];
    else band[key] = Math.min(VITAL_META[vital].max, Math.max(VITAL_META[vital].min, n));
    if (Object.keys(band).length === 0) delete next[vital];
    onChange({
      alarmProfile: monitoring?.alarmProfile,
      alarmLimits: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  const shown = (vital: AlarmVital, key: AlarmBandKey): string => {
    const value = overrides?.[vital]?.[key];
    return value === null ? 'off' : value === undefined ? '' : String(value);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="label">Patient category</span>
        <select
          className="input w-auto"
          value={profile}
          onChange={(e) => {
            const next = e.target.value as AlarmProfile;
            // Adult, the default, is never stored.
            onChange({ alarmProfile: next === 'adult' ? undefined : next, alarmLimits: overrides });
          }}
        >
          {(Object.keys(ALARM_PROFILE_LABELS) as AlarmProfile[]).map((p) => (
            <option key={p} value={p}>
              {ALARM_PROFILE_LABELS[p]}
              {p === 'adult' ? ' — default' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="pr-3 font-normal">Vital</th>
              {ALARM_BAND_KEYS.map((key) => (
                <th key={key} className="pr-2 font-normal">
                  {BAND_LABELS[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALARM_VITALS.map((vital) => (
              <tr key={vital}>
                <td className="pr-3 text-ink-2">
                  {VITAL_META[vital].label}
                  {VITAL_META[vital].unit && (
                    <span className="text-xs text-faint"> {VITAL_META[vital].unit}</span>
                  )}
                </td>
                {ALARM_BAND_KEYS.map((key) => (
                  <td key={key} className="py-0.5 pr-2">
                    <LimitInput
                      label={`${VITAL_META[vital].label} ${BAND_LABELS[key].toLowerCase()} limit`}
                      placeholder={base[vital][key] === undefined ? 'none' : String(base[vital][key])}
                      value={shown(vital, key)}
                      onCommit={(raw) => setLimit(vital, key, raw)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {problems.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red">
          {problems.map((p) => (
            <li key={p.message}>{p.message}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-faint">
        Grey numbers are the category’s limits. Type a number to change one for this case, or
        “off” to switch it off; clear the box to go back. Below Low or above High is a warning;
        beyond a critical limit the alarm is critical. Blood-pressure limits are systolic.
      </p>
    </div>
  );
}
