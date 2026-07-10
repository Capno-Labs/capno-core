'use client';

import { create } from 'zustand';
import type { SimSnapshot } from '../engine/types';
import { createSyncChannels, type SyncChannel, type TransportHealth } from '../sync';

/**
 * Student display store — a read-only mirror. Joins a session by code and
 * renders whatever snapshot the faculty controller last broadcast.
 *
 * Liveness: the controller broadcasts a snapshot every 500 ms whether the
 * sim is running or not, so a local watchdog can detect a dead controller
 * (crashed tab, network loss) without any protocol additions. The student
 * still sends nothing but `hello`.
 */

/** No snapshot within this window after `hello` → the code is likely wrong. */
const JOIN_TIMEOUT_MS = 8000;
/** No snapshot for this long while live (≈8 missed broadcasts) → stale. */
const STALE_AFTER_MS = 4000;

export type StudentPhase = 'idle' | 'joining' | 'live' | 'stale' | 'ended' | 'join_failed';

interface StudentState {
  sessionId: string;
  snapshot: SimSnapshot | null;
  phase: StudentPhase;
  /** Per-transport sync state for the health indicator. */
  syncHealth: TransportHealth[];
  join: (sessionId: string) => void;
  leave: () => void;
}

let channel: SyncChannel | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let joinedAtMs = 0;
let lastSnapshotAtMs = 0;

function clearWatchdog() {
  if (watchdog) {
    clearInterval(watchdog);
    watchdog = null;
  }
}

export const useStudentStore = create<StudentState>((set, get) => ({
  sessionId: '',
  snapshot: null,
  phase: 'idle',
  syncHealth: [],

  join: (sessionId) => {
    const code = sessionId.trim().toUpperCase();
    if (!code) return;
    get().leave();
    channel = createSyncChannels(code);
    channel.onStatus(() => set({ syncHealth: channel ? channel.getHealth() : [] }));
    channel.onMessage((m) => {
      if (m.type === 'snapshot') {
        lastSnapshotAtMs = Date.now();
        set({ snapshot: m.snapshot, phase: 'live' });
      }
      if (m.type === 'bye') set({ phase: 'ended' });
    });
    joinedAtMs = Date.now();
    set({ sessionId: code, snapshot: null, phase: 'joining', syncHealth: channel.getHealth() });
    watchdog = setInterval(() => {
      const { phase } = get();
      if (phase === 'joining' && Date.now() - joinedAtMs > JOIN_TIMEOUT_MS) {
        set({ phase: 'join_failed' });
      } else if (phase === 'live' && Date.now() - lastSnapshotAtMs > STALE_AFTER_MS) {
        // Keep the last snapshot on screen; recovery is automatic because
        // any later snapshot flips the phase back to live.
        set({ phase: 'stale' });
      }
    }, 1000);
    // Ask the controller for an immediate snapshot (covers late join/refresh).
    channel.send({ type: 'hello' });
  },

  leave: () => {
    clearWatchdog();
    channel?.close();
    channel = null;
    set({ sessionId: '', snapshot: null, phase: 'idle', syncHealth: [] });
  },
}));
