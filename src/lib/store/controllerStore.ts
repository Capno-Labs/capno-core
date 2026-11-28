'use client';

import { create } from 'zustand';
import { generateSessionId, isValidSessionCode, SimulationEngine } from '../engine/engine';
import { adhocEventId } from '../engine/flow';
import { eventSchema } from '../engine/schema';
import { scoreSession } from '../engine/scoring';
import type {
  ActionStatus,
  AlarmProfile,
  AlarmParam,
  AlarmSide,
  AnestheticAgent,
  CapnoShape,
  NumericVitals,
  EcgMorphology,
  NeuromuscularBlock,
  PvcFrequency,
  Rhythm,
  Scenario,
  ScenarioEvent,
  SimSnapshot,
  Ventilation,
} from '../engine/types';
import { cloudEligible, drain, enqueue, pinnedVersionId } from '../cloud/outbox';
import '../cloud/sessionCloud'; // registers the session push handler
import { getVersionHistory } from '../scenarios/customStore';
import { createSyncChannels, type SyncChannel, type TransportHealth } from '../sync';
import { toDisplaySnapshot } from '../sync/displaySnapshot';
import { applyMonitorRequest, createRequestGate } from '../sync/monitorRequest';
import { archiveSession } from './sessionArchive';

/**
 * Faculty controller store — owns the authoritative SimulationEngine,
 * ticks it on a wall-clock interval, and after every tick and every faculty
 * command broadcasts the monitor's view of the snapshot to student displays.
 * The full snapshot (notes, log, rubric marks) stays in this store.
 */

const TICK_MS = 500;

interface ControllerState {
  engine: SimulationEngine | null;
  snapshot: SimSnapshot | null;
  sessionId: string;
  /**
   * What students type to join — the sync channel name. Equals sessionId for
   * a fresh session; stays the same across "Run next student" turnovers while
   * each run keeps its own sessionId (the archive key, which must be unique —
   * archives are replaced on same-id save).
   */
  sessionCode: string;
  /** Set when the session archive could not be persisted (storage full). */
  archiveWarning: string | null;
  /** Per-transport sync state for the health indicator. */
  syncHealth: TransportHealth[];

  loadScenario: (scenario: Scenario, code?: string) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  endAndArchive: () => string | null;

  setVital: (key: keyof NumericVitals, value: number, overSec?: number) => void;
  setRhythm: (rhythm: Rhythm) => void;
  setCapnoShape: (shape: CapnoShape) => void;
  setPvcFrequency: (freq: PvcFrequency) => void;
  /** Set anesthesia-machine readings; each ramps over `overSec`. */
  setVent: (patch: Partial<Ventilation>, overSec?: number) => void;
  /** Show or hide the machine tiles on the monitor. */
  setVentShown: (on: boolean) => void;
  setAgent: (agent: AnestheticAgent) => void;
  /** Set the neuromuscular block; each field ramps over `overSec`. */
  setNmb: (patch: Partial<NeuromuscularBlock>, overSec?: number) => void;
  /** Switch the monitor's patient category and its alarm limits. */
  setAlarmProfile: (profile: AlarmProfile) => void;
  /** One press of − or + on a vital's low or high alarm limit. */
  stepAlarmLimit: (vital: AlarmParam, side: AlarmSide, direction: -1 | 1) => void;
  /** Switch one vital's limit alarms off or back on. */
  setAlarmOff: (vital: AlarmParam, off: boolean) => void;
  /** Let learners operate the alarm setup from their display, or not. */
  setLearnerAlarmSetup: (on: boolean) => void;
  /** Attach or remove the twitch monitor. */
  setTofAttached: (on: boolean) => void;
  /** Have the twitch monitor stimulate now. */
  measureTof: () => void;
  /** Set the inspired CO2 (rebreathing), ramping over `overSec`. */
  setFico2: (target: number, overSec?: number) => void;
  /** Take the pulse away (PEA, pulseless VT) or give it back. */
  setPulseless: (on: boolean) => void;
  /** Change ECG morphology; the ST level ramps over `overSec`. */
  setEcg: (patch: EcgMorphology, overSec?: number) => void;
  triggerEvent: (eventId: string) => void;
  /**
   * Add an instructor-improvised event to the running session. Ad-hoc events
   * are fire-when-ready only — the Omit keeps autoAtSec and rubric links out
   * at the type level. Returns the generated event id, or null if no session
   * is loaded.
   */
  addAdhocEvent: (event: Omit<ScenarioEvent, 'id' | 'autoAtSec' | 'actionIds'>) => string | null;
  /** Pin which event "next up" and the N hotkey point at (null clears). */
  pinNextEvent: (eventId: string | null) => void;
  setPhase: (phaseId: string) => void;
  markAction: (actionId: string, status: ActionStatus) => void;
  addNote: (text: string) => void;
  setAlarmsSilenced: (silenced: boolean) => void;
  /** The monitor's Silence key: acknowledge the alarms active now. */
  acknowledgeAlarms: () => void;
  setAutoEvents: (on: boolean) => void;
  /** Show or hide the patient pre-brief on student displays before the start. */
  setPreBrief: (on: boolean) => void;
  skipAhead: (sec: number) => void;
  cycleNibp: () => void;
  setArtLine: (on: boolean) => void;
  /** Add or remove the V5 lead on the monitor. */
  setV5Lead: (on: boolean) => void;

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
    // Displays get the monitor fields only — see sync/displaySnapshot.ts.
    channel?.send({ type: 'snapshot', snapshot: toDisplaySnapshot(snapshot) });
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
    sessionCode: '',
    archiveWarning: null,
    syncHealth: [],

    loadScenario: (scenario, code) => {
      get().teardown();
      // The sessionId (archive key) is always fresh; a passed code reuses the
      // sync channel so student displays from the previous run reconnect on
      // the next snapshot without re-joining ("Run next student").
      const sessionId = generateSessionId();
      const trimmed = code?.trim().toUpperCase() ?? '';
      const sessionCode = isValidSessionCode(trimmed) ? trimmed : sessionId;
      // Auto-fire defaults off in the controller: the instructor is the
      // pacemaker on a timed lab day. The toggle is an instructor preference,
      // so it carries over from the previous engine (scenario switches and
      // "Run next student" turnovers keep the instructor's choice).
      const autoEvents = get().engine?.getAutoEventsEnabled() ?? false;
      // The pre-brief choice carries over the same way (default: not shown).
      const preBrief = get().engine?.getPreBriefEnabled() ?? false;
      // So does whether learners may operate the alarm setup (default: yes).
      const learnerAlarmSetup = get().engine?.getLearnerAlarmSetup() ?? true;
      const engine = new SimulationEngine(scenario, sessionId, { autoEvents, preBrief, learnerAlarmSetup });
      channel = createSyncChannels(sessionCode);
      const freshRequest = createRequestGate();
      // Late-joining student displays send 'hello' to get an immediate snapshot.
      channel.onMessage((m) => {
        if (m.type === 'hello') publish();
        // A learner operating the monitor's alarm setup on a display: the
        // only thing a display can change, checked and applied here so this
        // engine stays the single authority.
        if (m.type === 'monitor' && freshRequest(m.id) && applyMonitorRequest(engine, m.request)) publish();
      });
      channel.onStatus(() => set({ syncHealth: channel ? channel.getHealth() : [] }));
      set({ engine, sessionId, sessionCode, syncHealth: channel.getHealth() });
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
      // Pin the archive to the cloud version row this scenario's local head
      // was last pushed as — only when the local head is exactly what the
      // cloud has (bundled scenarios and unsynced edits pin nothing).
      const versionId = cloudEligible()
        ? pinnedVersionId(engine.scenario.id, getVersionHistory(engine.scenario.id)[0]?.savedAtIso)
        : null;
      const result = archiveSession({
        sessionId: snapshot.sessionId,
        sessionCode: get().sessionCode,
        ...(versionId !== null ? { scenarioVersionId: versionId } : {}),
        // The effective scenario (authored + live-added events) keeps the
        // archive self-consistent with firedEventIds and the debrief log.
        scenario: engine.getEffectiveScenario(),
        // Broadcast snapshots carry only a log tail; the archive gets the
        // full record so the debrief is complete.
        snapshot: { ...snapshot, log: engine.getFullLog() },
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
    setRhythm: (rhythm) => withEngine((e) => e.setRhythm(rhythm)),
    setCapnoShape: (shape) => withEngine((e) => e.setCapnoShape(shape)),
    setPvcFrequency: (freq) => withEngine((e) => e.setPvcFrequency(freq)),
    setEcg: (patch, overSec = 0) => withEngine((e) => e.setEcg(patch, overSec)),
    setPulseless: (on) => withEngine((e) => e.setPulseless(on)),
    setFico2: (target, overSec = 0) => withEngine((e) => e.setFico2(target, overSec)),
    setVent: (patch, overSec = 0) => withEngine((e) => e.setVent(patch, overSec)),
    setVentShown: (on) => withEngine((e) => e.setVentShown(on)),
    setAgent: (agent) => withEngine((e) => e.setAgent(agent)),
    setNmb: (patch, overSec = 0) => withEngine((e) => e.setNmb(patch, overSec)),
    setAlarmProfile: (profile) => withEngine((e) => e.setAlarmProfile(profile)),
    stepAlarmLimit: (vital, side, direction) => withEngine((e) => e.stepAlarmLimit(vital, side, direction)),
    setLearnerAlarmSetup: (on) => withEngine((e) => e.setLearnerAlarmSetup(on)),
    setAlarmOff: (vital, off) => withEngine((e) => e.setAlarmOff(vital, off)),
    setTofAttached: (on) => withEngine((e) => e.setTofAttached(on)),
    measureTof: () => withEngine((e) => e.measureTof()),
    // Firing an event or marking an action is live-session work: if the
    // session hasn't started (or is paused), the tap also starts/resumes it —
    // faculty shouldn't need a separate Start press to react to the room.
    // Ended sessions are never restarted.
    triggerEvent: (eventId) =>
      withEngine((e) => {
        const status = e.getStatus();
        if (status === 'idle' || status === 'paused') e.start();
        e.triggerEvent(eventId);
      }),
    addAdhocEvent: (event) => {
      const { engine } = get();
      if (!engine) return null;
      const id = adhocEventId(engine.getEvents());
      const candidate = { ...event, id };
      // Zod at the boundary: the form pre-validates for friendly messages,
      // but the store is the choke point every caller goes through — an
      // invalid event would poison the archive (getEffectiveScenario must
      // stay scenarioSchema-valid for export/import and cloud pull).
      if (!eventSchema.safeParse(candidate).success) return null;
      if (!engine.addEvent(candidate)) return null;
      publish();
      return id;
    },
    pinNextEvent: (eventId) => withEngine((e) => e.pinNextEvent(eventId)),
    setPhase: (phaseId) => withEngine((e) => e.setPhase(phaseId)),
    markAction: (actionId, status) =>
      withEngine((e) => {
        const simStatus = e.getStatus();
        if (simStatus === 'idle' || simStatus === 'paused') e.start();
        e.markAction(actionId, status);
      }),
    addNote: (text) => withEngine((e) => e.addNote(text)),
    setAlarmsSilenced: (silenced) => withEngine((e) => e.setAlarmsSilenced(silenced)),
    acknowledgeAlarms: () => withEngine((e) => e.acknowledgeAlarms()),
    setAutoEvents: (on) => withEngine((e) => e.setAutoEvents(on)),
    setPreBrief: (on) => withEngine((e) => e.setPreBrief(on)),
    skipAhead: (sec) => withEngine((e) => e.skipAhead(sec)),
    cycleNibp: () => withEngine((e) => e.cycleNibp()),
    setArtLine: (on) => withEngine((e) => e.setArtLine(on)),
    setV5Lead: (on) => withEngine((e) => e.setV5Lead(on)),

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
      set({
        engine: null,
        snapshot: null,
        sessionId: '',
        sessionCode: '',
        archiveWarning: null,
        syncHealth: [],
      });
    },
  };
});
