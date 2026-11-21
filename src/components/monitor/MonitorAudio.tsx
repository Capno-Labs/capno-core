'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimSnapshot } from '@/lib/engine/types';
import { migrateLegacyKey } from '@/lib/legacyStorage';
import { ALARM_PATTERNS, alarmTier, type AlarmTier } from './alarmTones';
import type { BeatClock } from './beatClock';
import { getMonitorAudioContext, unlockMonitorAudio } from './monitorAudioContext';
import {
  defaultSoundLevel,
  LEGACY_SOUND_KEY,
  readSoundLevel,
  soundGain,
  writeSoundLevel,
  type SoundLevel,
  type SoundRole,
} from './soundPref';
import { isPulseless, R_OFFSET_MS } from './waveforms';

/**
 * Monitor audio via Web Audio (no dependencies):
 *  - Pulse tone: one short beep per heartbeat, pitch mapped to SpO₂ — the
 *    falling-pitch desaturation cue anesthetists are trained to hear. Beats
 *    come from the monitor's shared BeatClock, so each beep lands on the R
 *    wave being drawn (and an irregular rhythm sounds irregular).
 *  - Alarm tones: a repeating burst while an alarm is active and faculty has
 *    not silenced alarms — ten quick high pulses for critical, three slower
 *    low ones for a warning (see alarmTones.ts).
 *
 * Browsers only start audio from a user gesture. The shared context
 * (monitorAudioContext.ts) is unlocked by the student's Join click or any
 * tap on the page; until then nothing is scheduled, so no backlog of sound
 * plays when it unlocks. The level preference persists per device and role.
 */
export function useSoundLevel(role: SoundRole): [SoundLevel, (level: SoundLevel) => void] {
  const [level, setLevel] = useState<SoundLevel>(defaultSoundLevel(role));
  useEffect(() => {
    migrateLegacyKey(LEGACY_SOUND_KEY);
    try {
      setLevel(readSoundLevel(role, window.localStorage));
    } catch {
      /* private browsing */
    }
  }, [role]);
  const update = (next: SoundLevel) => {
    setLevel(next);
    try {
      writeSoundLevel(role, next, window.localStorage);
    } catch {
      /* ignore */
    }
  };
  return [level, update];
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
/** How often the alarm scheduler checks the alarm state. */
const ALARM_POLL_MS = 100;

export function MonitorAudio({
  snapshot,
  level,
  clock,
}: {
  snapshot: SimSnapshot;
  level: SoundLevel;
  /** The monitor's shared heartbeat clock (see MonitorDisplay). */
  clock: BeatClock;
}) {
  // Live values read by the schedulers without re-registering timers.
  const live = useRef({ snapshot, clock });
  live.current = { snapshot, clock };

  useEffect(() => {
    if (level === 'off') return;
    const ctx = getMonitorAudioContext();
    if (!ctx) return;
    // Succeeds if the page has already had a gesture (the Join click);
    // otherwise the first tap anywhere unlocks it (see MonitorDisplay).
    unlockMonitorAudio();

    const master = ctx.createGain();
    master.gain.value = soundGain(level);
    master.connect(ctx.destination);

    const tone = (
      type: OscillatorType,
      freq: number,
      durSec: number,
      gainValue: number,
      at: number,
    ): OscillatorNode => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(gainValue, at + 0.005);
      gain.gain.setValueAtTime(gainValue, at + durSec - 0.02);
      gain.gain.linearRampToValueAtTime(0, at + durSec);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + durSec);
      return osc;
    };

    // ── Pulse tone: one beep on the R wave of every beat the clock starts ──
    let heard = live.current.clock.count;
    const pulseTimer = setInterval(() => {
      const { snapshot: s, clock: beats } = live.current;
      beats.tick(performance.now());
      const fresh = beats.count - heard;
      heard = beats.count;
      if (fresh <= 0 || ctx.state !== 'running') return;
      const v = s.vitals;
      if (s.status !== 'running' || isPulseless(v.rhythm) || v.hr <= 0) return;
      for (const beat of beats.recent().slice(-fresh)) {
        const untilR = beat.startSec + R_OFFSET_MS / 1000 - beats.t;
        if (untilR < -LATE_BEEP_SEC) continue;
        tone('sine', pulseFrequency(v.spo2), 0.06, 0.12, ctx.currentTime + Math.max(0, untilR));
      }
    }, BEAT_POLL_MS);

    // ── Alarm tones: a burst per priority, restarted the moment it changes ──
    let sounding: AlarmTier | null = null;
    let nextBurstAt = 0;
    let pending: OscillatorNode[] = [];
    const cancelPending = () => {
      for (const osc of pending) {
        try {
          osc.stop();
        } catch {
          /* already finished */
        }
      }
      pending = [];
    };
    const alarmTimer = setInterval(() => {
      const tier = ctx.state === 'running' ? alarmTier(live.current.snapshot) : null;
      const now = ctx.currentTime;
      if (tier !== sounding) {
        // Silenced, resolved, or a different priority: cut the old burst short
        // and start the new one straight away.
        cancelPending();
        sounding = tier;
        nextBurstAt = now;
      }
      if (!tier || now < nextBurstAt) return;
      const pattern = ALARM_PATTERNS[tier];
      pending = pattern.pulses.map((p) =>
        tone('triangle', pattern.freq, p.durSec, pattern.gain, now + p.atSec),
      );
      nextBurstAt = now + pattern.repeatSec;
    }, ALARM_POLL_MS);

    return () => {
      clearInterval(pulseTimer);
      clearInterval(alarmTimer);
      cancelPending();
      master.disconnect();
    };
  }, [level]);

  return null;
}
