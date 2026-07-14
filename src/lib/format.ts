/**
 * m:ss clock for elapsed/remaining scenario time (negative clamps to 0:00).
 * The one shared formatter for the run screen — phase timers, budget badge,
 * flow timing hints, and action timestamps must never format differently.
 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
