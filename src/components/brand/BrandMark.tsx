import { CapnoSymbol } from './CapnoSymbol';

/**
 * The symbol at the app's standard sizes. `tone` picks the colour the brand
 * rules call for (docs/brand.md): `theme` is white on the dark studio and
 * cobalt on the light one; `white` is for the blue poster surfaces, in both
 * themes.
 */
export function BrandMark({
  size = 'md',
  tone = 'theme',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'theme' | 'white';
  className?: string;
}) {
  const box = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return <CapnoSymbol className={`shrink-0 ${box} ${tone === 'white' ? 'text-white' : 'text-logo'} ${className}`} />;
}
