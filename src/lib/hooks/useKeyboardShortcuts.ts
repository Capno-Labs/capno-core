'use client';

import { useEffect, useRef } from 'react';

/**
 * Global keyboard shortcuts, keyed by KeyboardEvent.key. Ignores repeats,
 * modifier combos, and anything typed while an input, textarea, select,
 * button, or contentEditable element has focus — a stray keypress must never
 * fire a control mid-teaching.
 */
export function useKeyboardShortcuts(
  bindings: Record<string, () => void>,
  enabled = true,
): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }
      // Case-fold single-character keys so CapsLock (or Shift) can't silently
      // kill an advertised letter shortcut.
      const action =
        bindingsRef.current[e.key] ??
        (e.key.length === 1 ? bindingsRef.current[e.key.toLowerCase()] : undefined);
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
