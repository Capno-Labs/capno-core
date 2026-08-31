/**
 * Conic-gradient score ring (screen only — the print report renders the
 * score as text). Amber sweep over the inset panel tint.
 */
export function ScoreRing({ percent, size = 96 }: { percent: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(rgb(var(--amber)) 0 ${clamped}%, rgb(var(--panel-2)) ${clamped}% 100%)`,
      }}
      role="img"
      aria-label={`Score ${clamped} percent`}
    >
      <div className="absolute inset-[9px] rounded-full bg-panel" />
      <span className="relative text-2xl font-extrabold tabular-nums text-ink">{clamped}%</span>
    </div>
  );
}
