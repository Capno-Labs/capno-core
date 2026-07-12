# CAPNO brand mark

One idealized capnogram breath: sharp expiratory upstroke, gently ascending
alveolar plateau, sharp inspiratory downstroke. The wordmark in the lockups
is JetBrains Mono Medium (OFL) converted to outlines — no font dependency.

## Files (`public/brand/`)

- `capno-icon.svg` — 512×512 app icon / favicon source (monitor tile + amber breath)
- `capno-glyph.svg` — bare amber glyph, for dark backgrounds
- `capno-glyph-light.svg` — bare ink glyph, for light backgrounds
- `capno-lockup-horizontal.svg` — glyph + CAPNO, dark backgrounds
- `capno-lockup-horizontal-light.svg` — glyph + CAPNO, light backgrounds
- `capno-lockup-stacked.svg` — glyph + CAPNO + STUDIO suffix, dark backgrounds

The PNG app icons in `public/icons/` are generated from the same geometry by
`scripts/gen-icons.mjs` (`npm run icons`) — never hand-edit them. The
in-app glyph is `src/components/brand/CapnoGlyph.tsx` (same path,
`stroke="currentColor"`).

## Color tokens

- Monitor black `#05080d` (Tailwind `monitor.bg`; site theme color; tile fill)
- EtCO₂ yellow `#facc15` (Tailwind `vital.etco2`) — the mark's color, dark backgrounds only
- Ink `#0f172a` (slate-900) — replaces amber on light backgrounds (amber on white fails contrast)
- Paper text `#e2e8f0` (slate-200), muted slate `#64748b` (slate-500)

## Rules

- Amber is reserved for the glyph and EtCO₂ values; never body text or buttons.
- The plateau ascends slightly by design — don't flatten it.
- Baseline of the wordmark sits on the waveform baseline; keep that alignment if re-composing.
- Minimum sizes: glyph 16px tall in-tile, horizontal lockup 24px tall.
- Clear space: half the glyph height on all sides (the SVG viewBoxes already include it).
- Never place the bare yellow glyph on light surfaces — use the ink glyph, or
  the yellow breath on a mini monitor tile (`#05080d`), as the marketing-site
  header does.
- Green (`vital.ecg` `#22e05f`) is ECG grammar in the monitor UI, not the
  brand mark. Violet is an action color only; it never appears in the logo.
