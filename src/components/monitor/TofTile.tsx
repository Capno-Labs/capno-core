'use client';

import type { TofReading } from '@/lib/engine/types';
import { TOF_PULSE_INTERVAL_MS, twitchHeights } from './readouts';

/**
 * The twitch monitor's tile: the train-of-four ratio as a percentage when all
 * four twitches are present and the count alone when fewer are — as a Philips
 * IntelliVue NMT ("when fewer than four twitches are detected, the monitor
 * displays a TOF count value instead") and an Organon TOF-Watch SX do — with
 * the post-tetanic count beneath when there are none. Four bars show the
 * twitches of the last train; they appear one after another at the stimulus
 * rate each time the monitor measures.
 */
export function TofTile({ reading }: { reading: TofReading }) {
  const heights = twitchHeights(reading);
  const hasRatio = reading.ratio !== null;
  const sub = hasRatio
    ? 'Count 4/4'
    : reading.ptc !== null
      ? `PTC ${reading.ptc}`
      : 'No ratio under 4 twitches';

  return (
    <div className="rounded-lg bg-monitor-panel px-3 py-2 ring-1 ring-monitor-grid">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-monitor-ink opacity-80">
          TOF
        </span>
        <span className="text-[10px] text-[#8d9688]">{hasRatio ? '%' : 'count'}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-3xl font-bold leading-none text-monitor-ink md:text-4xl">
          {hasRatio ? reading.ratio : `${reading.count}/4`}
        </span>
        {/* Re-keyed on each measurement so the four twitches play again. */}
        <span
          key={reading.atSec}
          className="flex h-8 items-end gap-1 border-b border-monitor-grid md:h-9"
          role="img"
          aria-label={`Twitches: ${reading.count} of 4`}
        >
          {heights.map((h, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom rounded-t-sm bg-monitor-ink motion-safe:animate-twitch"
              style={{
                height: `${Math.round(h * 100)}%`,
                animationDelay: `${i * TOF_PULSE_INTERVAL_MS}ms`,
              }}
            />
          ))}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-xs text-[#a8b0a2]">{sub}</div>
    </div>
  );
}
