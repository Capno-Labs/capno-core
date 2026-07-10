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
      const action = bindingsRef.current[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
