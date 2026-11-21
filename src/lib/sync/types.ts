import type { SimSnapshot } from '../engine/types';
import type { MonitorRequest } from './monitorRequest';

/**
 * Realtime sync between the faculty controller (authoritative) and student
 * displays (mirrors).
 *
 * State flows one way: the controller broadcasts full snapshots on every
 * tick and change. Snapshots are small (a few KB) and full-state replication
 * makes late joiners, refreshes, and dropped messages a non-issue — a
 * student display is always correct within one tick of connecting.
 *
 * A display sends two things back, neither of them state: `hello`, and
 * `monitor` — a request to operate the monitor's alarm setup, which the
 * controller validates and applies to its engine (see monitorRequest.ts).
 */

export type SyncMessage =
  | { type: 'snapshot'; snapshot: SimSnapshot }
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
