import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { SyncChannel, SyncMessage, TransportHealth, TransportState } from './types';

/**
 * Supabase Realtime adapter — cross-device sync (e.g., iPad controller and a
 * projector PC). Uses Realtime "broadcast" (ephemeral pub/sub, no rows
 * written per tick). Only active when NEXT_PUBLIC_SUPABASE_* env vars are set.
 */

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return client;
}

/** Consecutive send failures before the transport reports `error`. */
const SEND_FAILURE_THRESHOLD = 3;

export function createSupabaseChannel(sessionId: string): SyncChannel | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  const handlers = new Set<(m: SyncMessage) => void>();
  const statusHandlers = new Set<(h: TransportHealth) => void>();
  let state: TransportState = 'connecting';
  let sendFailures = 0;

  const setState = (next: TransportState) => {
    if (state === next || state === 'closed') return;
    state = next;
    const health: TransportHealth = { kind: 'supabase', state };
    for (const h of statusHandlers) h(health);
  };

  const channel: RealtimeChannel = supabase.channel(`capno:${sessionId.toUpperCase()}`, {
    config: { broadcast: { self: false } },
  });

  channel.on('broadcast', { event: 'sync' }, (payload) => {
    const message = payload.payload as SyncMessage;
    for (const h of handlers) h(message);
  });
  // supabase-js reconnects and rejoins on its own — we only report state.
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      sendFailures = 0;
      setState('connected');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      setState('error');
    } else if (status === 'CLOSED') {
      setState('closed');
    }
  });

  return {
    kind: 'supabase',
    send(message) {
      void channel
        .send({ type: 'broadcast', event: 'sync', payload: message })
        .then((result) => {
          if (result === 'ok') {
            sendFailures = 0;
            setState('connected');
          } else {
            sendFailures += 1;
            if (sendFailures >= SEND_FAILURE_THRESHOLD) setState('error');
          }
        })
        .catch(() => {
          sendFailures += 1;
          if (sendFailures >= SEND_FAILURE_THRESHOLD) setState('error');
        });
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
    getHealth() {
      return [{ kind: 'supabase', state }];
    },
    close() {
      handlers.clear();
      state = 'closed';
      statusHandlers.clear();
      void supabase.removeChannel(channel);
    },
  };
}
