import { createBroadcastChannel } from './broadcast';
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
 */
export function createSyncChannels(sessionId: string): SyncChannel {
  const channels: SyncChannel[] = [createBroadcastChannel(sessionId)];
  const supa = createSupabaseChannel(sessionId);
  if (supa) channels.push(supa);

  return {
    kind: channels.length > 1 ? 'supabase' : 'broadcast',
    send(message) {
      for (const c of channels) c.send(message);
    },
    onMessage(handler) {
      const offs = channels.map((c) => c.onMessage(handler));
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
