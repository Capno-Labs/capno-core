import type { SyncChannel, SyncMessage, TransportHealth } from './types';

/**
 * BroadcastChannel adapter — zero-config realtime between windows/tabs of the
 * same browser profile on the same device. This is the default transport and
 * works fully offline: typical lab setup is one laptop driving a projector
 * (student display window) with the faculty controller in a second window.
 */
export function createBroadcastChannel(sessionId: string): SyncChannel {
  const bc = new BroadcastChannel(`capno:${sessionId.toUpperCase()}`);
  const handlers = new Set<(m: SyncMessage) => void>();
  const statusHandlers = new Set<(h: TransportHealth) => void>();
  // BroadcastChannel has no connection lifecycle: it works from construction.
  let health: TransportHealth = { kind: 'broadcast', state: 'connected' };

  bc.onmessage = (ev: MessageEvent<SyncMessage>) => {
    for (const h of handlers) h(ev.data);
  };

  return {
    kind: 'broadcast',
    send(message) {
      try {
        bc.postMessage(message);
      } catch {
        // Channel already closed — ignore.
      }
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
      return [health];
    },
    close() {
      handlers.clear();
      health = { kind: 'broadcast', state: 'closed' };
      for (const h of statusHandlers) h(health);
      statusHandlers.clear();
      bc.close();
    },
  };
}
