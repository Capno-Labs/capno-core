/**
 * Pure helpers behind the form controls in `components/ui/` — parsing what
 * someone typed and moving list items. Framework-free so they test in Node.
 */

/**
 * Seconds from a typed time: "90" → 90, "1:30" → 90, "2:05" → 125, "1:02:03" →
 * 3723. A bare number is seconds. Null when it is not a time (empty, negative,
 * a seconds or minutes part of 60 or more, anything else).
 */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+):)?(\d+):(\d{1,2})$/.exec(t);
  if (!m) return null;
  const [h, min, sec] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (sec >= 60 || (m[1] !== undefined && min >= 60)) return null;
  return h * 3600 + min * 60 + sec;
}

/** Seconds as m:ss (h:mm:ss from an hour up) — what `parseTime` reads back. */
export function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * A number from a typed value. Null for empty or non-numeric text; otherwise
 * the number, untouched — range problems are reported, never silently clamped
 * (a clamp hides a typo like 1200 for 120).
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Plain-language problem with `value` for a ranged field, or null if fine. */
export function rangeProblem(
  value: number,
  { min, max, integer, unit }: { min?: number; max?: number; integer?: boolean; unit?: string },
): string | null {
  const u = unit ? ` ${unit}` : '';
  if (integer && !Number.isInteger(value)) return 'Use a whole number.';
  if (min !== undefined && max !== undefined && (value < min || value > max)) {
    return `Use a value from ${min} to ${max}${u}.`;
  }
  if (min !== undefined && value < min) return `Use ${min}${u} or more.`;
  if (max !== undefined && value > max) return `Use ${max}${u} or less.`;
  return null;
}

/** A copy of `items` with the item at `from` moved to `to` (out of range: unchanged). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
