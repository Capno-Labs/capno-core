'use client';

import { create } from 'zustand';
import { generateSessionId, SimulationEngine } from '../engine/engine';
import { resolvePresetEffect, VITALS_PRESETS } from '../engine/presets';
import { scoreSession } from '../engine/scoring';
import type {
  ActionStatus,
  CapnoShape,
  NumericVitals,
  Rhythm,
  Scenario,
  SimSnapshot,
} from '../engine/types';
import { cloudEligible, drain, enqueue } from '../cloud/outbox';
import '../cloud/sessionCloud'; // registers the session push handler
import { createSyncChannels, type SyncChannel, type TransportHealth } from '../sync';
import { archiveSession } from './sessionArchive';

/**
 * Faculty controller store — owns the authoritative SimulationEngine,
 * ticks it on a wall-clock interval, and broadcasts a snapshot to student
 * displays after every tick and every faculty command.
 */

const TICK_MS = 500;

interface ControllerState {
  engine: SimulationEngine | null;
  snapshot: SimSnapshot | null;
  sessionId: string;
  /** Set when the session archive could not be persisted (storage full). */
  archiveWarning: string | null;
  /** Per-transport sync state for the health indicator. */
  syncHealth: TransportHealth[];

  loadScenario: (scenario: Scenario) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  endAndArchive: () => string | null;

  setVital: (key: keyof NumericVitals, value: number, overSec?: number) => void;
  applyPreset: (presetId: string) => void;
  setRhythm: (rhythm: Rhythm) => void;
  setCapnoShape: (shape: CapnoShape) => void;
  triggerEvent: (eventId: string) => void;
  setPhase: (phaseId: string) => void;
  markAction: (actionId: string, status: ActionStatus) => void;
  addNote: (text: string) => void;
  setAlarmsSilenced: (silenced: boolean) => void;
  skipAhead: (sec: number) => void;
  cycleNibp: () => void;
  setArtLine: (on: boolean) => void;

  teardown: () => void;
}

let tickHandle: ReturnType<typeof setInterval> | null = null;
let channel: SyncChannel | null = null;

export const useControllerStore = create<ControllerState>((set, get) => {
  const publish = () => {
    const { engine } = get();
    if (!engine) return;
    const snapshot = engine.snapshot();
    set({ snapshot });
    channel?.send({ type: 'snapshot', snapshot });
  };

  const withEngine = (fn: (engine: SimulationEngine) => void) => {
    const { engine } = get();
    if (!engine) return;
    fn(engine);
    publish();
  };

  return {
    engine: null,
    snapshot: null,
    sessionId: '',
    archiveWarning: null,
    syncHealth: [],

    loadScenario: (scenario) => {
      get().teardown();
      const sessionId = generateSessionId();
      const engine = new SimulationEngine(scenario, sessionId);
      channel = createSyncChannels(sessionId);
      // Late-joining student displays send 'hello' to get an immediate snapshot.
      channel.onMessage((m) => {
        if (m.type === 'hello') publish();
      });
      channel.onStatus(() => set({ syncHealth: channel ? channel.getHealth() : [] }));
      set({ engine, sessionId, syncHealth: channel.getHealth() });
      tickHandle = setInterval(() => {
        engine.tick(TICK_MS / 1000);
        publish();
      }, TICK_MS);
      publish();
    },

    start: () => withEngine((e) => e.start()),
    pause: () => withEngine((e) => e.pause()),
    reset: () => withEngine((e) => e.reset()),

    endAndArchive: () => {
      const { engine } = get();
      if (!engine) return null;
      engine.end();
      publish();
      const snapshot = engine.snapshot();
      const score = scoreSession(engine.scenario, snapshot.actions);
      const result = archiveSession({
        sessionId: snapshot.sessionId,
        scenario: engine.scenario,
        snapshot,
        endedAtIso: new Date().toISOString(),
        score,
        history: engine.getHistory(),
      });
      set({
        archiveWarning: result.ok
          ? null
          : 'Device storage is full — this debrief is held in memory only and will be lost when the tab closes. Export it as JSON from the debrief page.',
      });
      // Cloud is additive and non-blocking: the debrief navigation must not wait.
      if (cloudEligible()) {
        enqueue('session', snapshot.sessionId);
        void drain();
      }
      return snapshot.sessionId;
    },

    setVital: (key, value, overSec = 3) => withEngine((e) => e.setVital(key, value, overSec)),
    applyPreset: (presetId) =>
      withEngine((e) => {
        const preset = VITALS_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        e.applyNamedEffect(`Preset: ${preset.label}`, resolvePresetEffect(preset, e.scenario));
      }),
    setRhythm: (rhythm) => withEngine((e) => e.setRhythm(rhythm)),
    setCapnoShape: (shape) => withEngine((e) => e.setCapnoShape(shape)),
    triggerEvent: (eventId) => withEngine((e) => e.triggerEvent(eventId)),
    setPhase: (phaseId) => withEngine((e) => e.setPhase(phaseId)),
    markAction: (actionId, status) => withEngine((e) => e.markAction(actionId, status)),
    addNote: (text) => withEngine((e) => e.addNote(text)),
    setAlarmsSilenced: (silenced) => withEngine((e) => e.setAlarmsSilenced(silenced)),
    skipAhead: (sec) => withEngine((e) => e.skipAhead(sec)),
    cycleNibp: () => withEngine((e) => e.cycleNibp()),
    setArtLine: (on) => withEngine((e) => e.setArtLine(on)),

    teardown: () => {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
      if (channel) {
        channel.send({ type: 'bye' });
        channel.close();
        channel = null;
      }
      set({ engine: null, snapshot: null, sessionId: '', archiveWarning: null, syncHealth: [] });
    },
  };
});
