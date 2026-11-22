/**
 * Which global shortcut keys a focused element takes for itself. Pure (no DOM
 * access) so the rule is testable in Node; `useKeyboardShortcuts` describes
 * the event target and asks here.
 *
 * - `all`: the element is being typed into, or a modal dialog is open — no
 *   shortcut may fire.
 * - `activation`: the element is operated with Space/Enter (a button, link,
 *   checkbox…), so those two keys are its own; every other shortcut still
 *   works. Without this, clicking any button silently killed the letter
 *   shortcuts until focus moved.
 * - `none`: nothing is reserved (the page body, a range slider).
 */
export type ShortcutBlock = 'all' | 'activation' | 'none';

/** What the hook reads off the focused element. */
export interface ShortcutTarget {
  /** Upper-case tag name, as `Element.tagName` gives it. */
  tagName: string;
  /** `type` attribute of an INPUT. */
  inputType?: string | null;
  role?: string | null;
  isContentEditable?: boolean;
  /** Focus is inside a native `<dialog>`, or one is open as a modal. */
  inModal?: boolean;
}

/** INPUT types operated with Space/Enter rather than typed into. */
const ACTIVATION_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'reset',
  'submit',
]);

const ACTIVATION_ROLES = new Set([
  'button',
  'checkbox',
  'link',
  'menuitem',
  'option',
  'radio',
  'switch',
  'tab',
]);

const ACTIVATION_KEYS = new Set([' ', 'Enter']);

export function shortcutBlock(target: ShortcutTarget | null | undefined): ShortcutBlock {
  if (!target) return 'none';
  if (target.inModal || target.isContentEditable) return 'all';
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return 'all';
  if (tag === 'INPUT') {
    const type = (target.inputType ?? 'text').toLowerCase();
    // A slider is dragged, not typed into — and after a drag it keeps focus,
    // so it must not swallow the session's keys.
    if (type === 'range') return 'none';
    return ACTIVATION_INPUT_TYPES.has(type) ? 'activation' : 'all';
  }
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return 'activation';
  if (target.role && ACTIVATION_ROLES.has(target.role.toLowerCase())) return 'activation';
  return 'none';
}

/** Whether a global shortcut bound to `key` may fire with `target` focused. */
export function shortcutAllowed(key: string, target: ShortcutTarget | null | undefined): boolean {
  const block = shortcutBlock(target);
  if (block === 'all') return false;
  if (block === 'activation') return !ACTIVATION_KEYS.has(key);
  return true;
}
