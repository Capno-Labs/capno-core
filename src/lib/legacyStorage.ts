/**
 * One-time localStorage migration from the pre-rename `labsim:*` keys to the
 * current `capno:*` keys. Called lazily by each store before its first read,
 * so upgraded installs keep their archived sessions, custom scenarios, and
 * cloud outbox. An existing value under the new key always wins; the legacy
 * key is removed either way. Framework-free and safe to call during SSR
 * (no-ops without `window`).
 */

const LEGACY_PREFIX = 'labsim:';
const PREFIX = 'capno:';

export function migrateLegacyKey(key: string): void {
  if (typeof window === 'undefined' || !key.startsWith(PREFIX)) return;
  try {
    const legacyKey = LEGACY_PREFIX + key.slice(PREFIX.length);
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return;
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, legacy);
    }
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Storage unavailable (private browsing) — nothing to migrate.
  }
}
