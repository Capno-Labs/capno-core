import type { DisplaySnapshot } from './displaySnapshot';
import type { MonitorRequest } from './monitorRequest';

/**
 * Realtime sync between the faculty controller (authoritative) and student
 * displays (mirrors).
 *
 * State flows one way: on every tick and change the controller broadcasts
 * the display's whole view of the session — the monitor fields of the
 * snapshot, never the faculty-side record (see displaySnapshot.ts). The
 * view is small (1–2 KB) and sending all of it each time makes late
 * joiners, refreshes, and dropped messages a non-issue — a student display
 * is always correct within one tick of connecting.
 *
 * A display sends two things back, neither of them state: `hello`, and
 * `monitor` — a request to operate the monitor's alarm setup, which the
 * controller validates and applies to its engine (see monitorRequest.ts).
 */

export type SyncMessage =
  | { type: 'snapshot'; snapshot: DisplaySnapshot }
  | { type: 'hello' } // student asks the controller to re-broadcast immediately
  // Student operates the alarm setup. Untrusted until parsed; `id` lets the
  // controller count a request once when it arrives on two transports.
  | { type: 'monitor'; id: string; request: MonitorRequest }
  | { type: 'bye' }; // controller left / session torn down

export type TransportState = 'connecting' | 'connected' | 'error' | 'closed';

/**
 * Adapter-local connection health, surfaced to the UI (sync indicator).
 * This is metadata about the transport, never sent over the wire.
 */
export interface TransportHealth {
  kind: 'broadcast' | 'supabase';
  state: TransportState;
}

export interface SyncChannel {
  readonly kind: 'broadcast' | 'supabase';
  send(message: SyncMessage): void;
  onMessage(handler: (message: SyncMessage) => void): () => void;
  /** Subscribe to transport state transitions. Returns an unsubscribe fn. */
  onStatus(handler: (health: TransportHealth) => void): () => void;
  /** Current state of each underlying transport (one entry per transport). */
  getHealth(): TransportHealth[];
  close(): void;
}
