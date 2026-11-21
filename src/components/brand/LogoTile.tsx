import { CapnoGlyph } from './CapnoGlyph';

/**
 * The brand mark on its mini monitor tile. The tile is what lets the EtCO2
 * yellow live on any surface — the bare yellow glyph never sits on a light
 * background (docs/brand.md). Always dark, in both themes.
 */
export function LogoTile({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-xl' : size === 'sm' ? 'h-7 w-7 rounded-ctl' : 'h-9 w-9 rounded-ctl';
  const glyph = size === 'lg' ? 'h-6' : size === 'sm' ? 'h-3' : 'h-4';
  return (
    <span
      className={`grid shrink-0 place-items-center bg-monitor-bg ring-1 ring-monitor-grid ${box} ${className}`}
    >
      <CapnoGlyph className={`${glyph} w-auto text-vital-etco2`} />
    </span>
  );
}
