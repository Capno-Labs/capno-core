'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimSnapshot } from '@/lib/engine/types';
import type { BeatClock } from './beatClock';
import { isPulseless, R_OFFSET_MS } from './waveforms';
import { migrateLegacyKey } from '@/lib/legacyStorage';

const PREF_KEY = 'capno:monitor-sound:v1';

/**
 * Monitor audio via Web Audio (no dependencies):
 *  - Pulse tone: one short beep per heartbeat, pitch mapped to SpO₂ — the
 *    falling-pitch desaturation cue anesthetists are trained to hear. Beats
 *    come from the monitor's shared BeatClock, so each beep lands on the R
 *    wave being drawn (and an irregular rhythm sounds irregular).
 *  - Alarm tone: repeating two-tone while a critical alarm is active and
 *    faculty has not silenced alarms.
 *
 * Browser autoplay policy requires a user gesture, so sound defaults to OFF
 * and the AudioContext is created when the user first toggles it on.
 * The preference persists per device.
 */
export function useMonitorSoundPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    migrateLegacyKey(PREF_KEY);
    try {
      setOn(window.localStorage.getItem(PREF_KEY) === '1');
    } catch {
      /* private browsing */
    }
  }, []);
  const update = (next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(PREF_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  return [on, update];
}

/** SpO₂ → pulse-tone frequency: ~880 Hz at 100%, falling roughly half an octave by 80%. */
function pulseFrequency(spo2: number): number {
  return 880 * Math.pow(2, (Math.min(100, spo2) - 100) / 30);
}

/** How often the pulse-tone scheduler looks for new beats. A beat is seen at
 *  its start and its R wave falls R_OFFSET_MS later, so this only has to be
 *  comfortably shorter than that lead. */
const BEAT_POLL_MS = 25;
/** A beat noticed this long after its R wave (timers throttled in a hidden
 *  tab) is dropped rather than beeped late. */
const LATE_BEEP_SEC = 0.1;

export function MonitorAudio({
  snapshot,
  enabled,
  clock,
}: {
  snapshot: SimSnapshot;
  enabled: boolean;
  /** The monitor's shared heartbeat clock (see MonitorDisplay). */
  clock: BeatClock;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  // Live values read by the schedulers without re-registering timers.
  const live = useRef({ snapshot, enabled, clock });
  live.current = { snapshot, enabled, clock };

  useEffect(() => {
    if (!enabled) return;

    type AC = typeof AudioContext;
    const Ctor: AC | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
    if (!Ctor) return;
    // Created inside the effect that runs after the user's toggle gesture.
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    void ctx.resume();

    const beep = (freq: number, durSec: number, gainValue: number, at = ctx.currentTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(gainValue, at + 0.005);
      gain.gain.setValueAtTime(gainValue, at + durSec - 0.02);
      gain.gain.linearRampToValueAtTime(0, at + durSec);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + durSec);
    };

    // ── Pulse tone: one beep on the R wave of every beat the clock starts ──
    let heard = live.current.clock.count;
    const pulseTimer = setInterval(() => {
      const { snapshot: s, enabled: on, clock: beats } = live.current;
      beats.tick(performance.now());
      const fresh = beats.count - heard;
      heard = beats.count;
      if (fresh <= 0) return;
      const v = s.vitals;
      if (!on || s.status !== 'running' || isPulseless(v.rhythm) || v.hr <= 0) return;
      for (const beat of beats.recent().slice(-fresh)) {
        const untilR = beat.startSec + R_OFFSET_MS / 1000 - beats.t;
        if (untilR < -LATE_BEEP_SEC) continue;
        beep(pulseFrequency(v.spo2), 0.06, 0.12, ctx.currentTime + Math.max(0, untilR));
      }
    }, BEAT_POLL_MS);

    // ── Alarm tone: two-tone burst every 2 s while critical + not silenced ──
    const alarmTimer = setInterval(() => {
      const { snapshot: s, enabled: on } = live.current;
      if (!on || s.alarmsSilenced || s.status !== 'running') return;
      if (!s.alarms.some((a) => a.level === 'critical')) return;
      beep(988, 0.12, 0.18);
      beep(784, 0.12, 0.18, ctx.currentTime + 0.16);
    }, 2000);

    return () => {
      clearInterval(pulseTimer);
      clearInterval(alarmTimer);
      void ctx.suspend();
    };
  }, [enabled]);

  // Fully release the context on unmount.
  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return null;
}
