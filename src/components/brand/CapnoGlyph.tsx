/**
 * The CAPNO brand glyph: one idealized capnogram breath (see docs/brand.md;
 * same geometry as public/brand/capno-glyph.svg). Strokes with currentColor
 * so the surrounding text class picks the color — amber (text-vital-etco2)
 * on dark surfaces, and the debrief print CSS turns it black on paper.
 */
export function CapnoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 476 269.6" aria-hidden className={className}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="43.27"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M47.09 222.72L120.91 222.72L143.82 62.36L342.36 47.09L360.18 222.72L454.36 222.72"
      />
    </svg>
  );
}
