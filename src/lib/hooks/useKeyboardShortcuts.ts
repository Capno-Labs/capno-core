'use client';

import { useEffect, useRef } from 'react';
import { shortcutAllowed, type ShortcutTarget } from '@/lib/hooks/shortcutGuard';

/** A modal <dialog> is open (`:modal` is unknown to older engines). */
function modalOpen(): boolean {
  try {
    return document.querySelector('dialog:modal') !== null;
  } catch {
    return document.querySelector('dialog[open]') !== null;
  }
}

function describeTarget(target: EventTarget | null): ShortcutTarget | null {
  const el = target instanceof HTMLElement ? target : null;
  const inModal = (el?.closest('dialog') ?? null) !== null || modalOpen();
  if (!el) return inModal ? { tagName: '', inModal } : null;
  return {
    tagName: el.tagName,
    inputType: el instanceof HTMLInputElement ? el.type : null,
    role: el.getAttribute('role'),
    isContentEditable: el.isContentEditable,
    inModal,
  };
}

/**
 * Global keyboard shortcuts, keyed by KeyboardEvent.key. Ignores repeats and
 * modifier combos, and yields to whatever has focus: nothing fires while a
 * field is being typed into or a modal dialog is open, and Space/Enter stay
 * with a focused button or link — a stray keypress must never fire a control
 * mid-teaching. Letter keys keep working after a click leaves focus on a
 * button (see shortcutGuard.ts for the rule).
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
      if (!shortcutAllowed(e.key, describeTarget(e.target))) return;
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
