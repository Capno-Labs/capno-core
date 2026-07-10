'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimSnapshot } from '@/lib/engine/types';
import { isPulseless } from './waveforms';
import { migrateLegacyKey } from '@/lib/legacyStorage';

const PREF_KEY = 'capno:monitor-sound:v1';

/**
 * Monitor audio via Web Audio (no dependencies):
 *  - Pulse tone: one short beep per heartbeat, pitch mapped to SpO₂ — the
 *    falling-pitch desaturation cue anesthetists are trained to hear.
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

export function MonitorAudio({ snapshot, enabled }: { snapshot: SimSnapshot; enabled: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null);
  // Live values read by the schedulers without re-registering timers.
  const live = useRef({ snapshot, enabled });
  live.current = { snapshot, enabled };

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

    // ── Pulse tone: self-rescheduling timeout so rate follows live HR ──
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePulse = () => {
      const { snapshot: s, enabled: on } = live.current;
      const v = s.vitals;
      const silent =
        !on || s.status !== 'running' || isPulseless(v.rhythm) || v.hr <= 0;
      const intervalMs = silent ? 500 : Math.max(250, 60000 / v.hr);
      if (!silent) beep(pulseFrequency(v.spo2), 0.06, 0.12);
      pulseTimer = setTimeout(schedulePulse, intervalMs);
    };
    schedulePulse();

    // ── Alarm tone: two-tone burst every 2 s while critical + not silenced ──
    const alarmTimer = setInterval(() => {
      const { snapshot: s, enabled: on } = live.current;
      if (!on || s.alarmsSilenced || s.status !== 'running') return;
      if (!s.alarms.some((a) => a.level === 'critical')) return;
      beep(988, 0.12, 0.18);
      beep(784, 0.12, 0.18, ctx.currentTime + 0.16);
    }, 2000);

    return () => {
      if (pulseTimer) clearTimeout(pulseTimer);
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
