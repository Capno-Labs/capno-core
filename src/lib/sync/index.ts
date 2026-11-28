import { createBroadcastChannel } from './broadcast';
import { toDisplaySnapshot } from './displaySnapshot';
import { createSupabaseChannel, supabaseConfigured } from './supabase';
import type { SyncChannel, SyncMessage, TransportHealth } from './types';

export type { SyncChannel, SyncMessage, TransportHealth };
export type { TransportState } from './types';
export { supabaseConfigured };

/**
 * Create the sync fan-out for a session. BroadcastChannel always runs (free,
 * offline, same-device); Supabase Realtime is added when configured so remote
 * displays receive the same messages. Handlers are registered on all
 * transports; sends go to all transports; health reports one entry per
 * transport.
 *
 * This is also the one place a snapshot crosses the wire, in either
 * direction, so it is where a snapshot is cut down to the display's fields
 * (displaySnapshot.ts): on the way out, whatever the caller passed, and on
 * the way in, whatever was sent. No transport sees anything else.
 */
function forWire(message: SyncMessage): SyncMessage {
  return message.type === 'snapshot'
    ? { type: 'snapshot', snapshot: toDisplaySnapshot(message.snapshot) }
    : message;
}

/** A received message, cut down the same way; null when it is not usable. */
function fromWire(message: SyncMessage): SyncMessage | null {
  if (message?.type !== 'snapshot') return message ?? null;
  // Anyone holding the code can send: a snapshot that is not an object is
  // dropped here rather than handed to a store.
  if (typeof message.snapshot !== 'object' || message.snapshot === null) return null;
  return forWire(message);
}

export function createSyncChannels(sessionId: string): SyncChannel {
  const channels: SyncChannel[] = [createBroadcastChannel(sessionId)];
  const supa = createSupabaseChannel(sessionId);
  if (supa) channels.push(supa);

  return {
    kind: channels.length > 1 ? 'supabase' : 'broadcast',
    send(message) {
      const wire = forWire(message);
      for (const c of channels) c.send(wire);
    },
    onMessage(handler) {
      const filtered = (message: SyncMessage) => {
        const usable = fromWire(message);
        if (usable) handler(usable);
      };
      const offs = channels.map((c) => c.onMessage(filtered));
      return () => offs.forEach((off) => off());
    },
    onStatus(handler) {
      const offs = channels.map((c) => c.onStatus(handler));
      return () => offs.forEach((off) => off());
    },
    getHealth(): TransportHealth[] {
      return channels.flatMap((c) => c.getHealth());
    },
    close() {
      for (const c of channels) c.close();
    },
  };
}
