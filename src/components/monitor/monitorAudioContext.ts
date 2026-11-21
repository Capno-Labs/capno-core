'use client';

import { useSyncExternalStore } from 'react';

/**
 * The page's one Web Audio context for monitor sound.
 *
 * Browsers only let audio start from a user gesture. The context is shared at
 * module level so a gesture anywhere can unlock it — the student's Join
 * click, the speaker button, or the first tap on a monitor opened from a
 * link — and so the UI can tell "sound is on" apart from "sound is on but
 * the browser has not been allowed to play it yet".
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The shared context, created on first use. Null where Web Audio is missing. */
export function getMonitorAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  ctx.addEventListener('statechange', notify);
  notify();
  return ctx;
}

/**
 * Ask the browser to start audio. Works when called from a user gesture
 * (click, tap, key press); elsewhere it is a harmless no-op until one happens.
 */
export function unlockMonitorAudio(): void {
  const audio = getMonitorAudioContext();
  if (audio && audio.state !== 'running') void audio.resume().catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True once the browser is actually playing monitor audio. */
export function useMonitorAudioRunning(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ctx?.state === 'running',
    () => false,
  );
}
