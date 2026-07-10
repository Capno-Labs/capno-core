import type { SimSnapshot } from '../engine/types';

/**
 * Realtime sync between the faculty controller (authoritative) and student
 * displays (read-only mirrors).
 *
 * Message flow is intentionally one-way state replication: the controller
 * broadcasts full snapshots on every tick and change. Snapshots are small
 * (a few KB) and full-state replication makes late joiners, refreshes, and
 * dropped messages a non-issue — a student display is always correct within
 * one tick of connecting.
 */

export type SyncMessage =
  | { type: 'snapshot'; snapshot: SimSnapshot }
  | { type: 'hello' } // student asks the controller to re-broadcast immediately
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
