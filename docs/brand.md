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

The app ships two themes — **dark is the default**, light is a user toggle —
driven by the CSS variables in `src/app/globals.css`. The patient monitor is
always dark in both themes.

Semantic neutrals (dark / light):

- Surface `#0d0f0c` / `#f4f4ef` — page background (also manifest + site theme color)
- Panel `#151713` / `#ffffff`, inset panel `#20231d` / `#eeeee8`
- Line `#30342b` / `#d8d9d0` — borders, rings, dividers
- Ink `#f2f3ec` / `#1b1c17`, muted `#b3b6ab` / `#686b61`

Accent and monitor:

- **Amber `#facc15` is the product accent** (Tailwind `amber`): primary
  buttons, pills, focus rings, highlights — and still the mark's color and
  EtCO₂ (`vital.etco2`). Amber-as-text uses `amber-strong`
  (`#ffe164` on dark, `#a16207` on light) — raw `#facc15` text fails
  contrast on light surfaces.
- Monitor black `#080a08` (Tailwind `monitor.bg`; tile fill) — theme-invariant
- ECG green `vital.ecg` `#73ef82`

## Rules

- Amber is the product accent and the mark's color. On light surfaces,
  amber text must use `amber-strong` (`#a16207`); amber fills pair with
  near-black ink text (`#1b1c17`), never white.
- The app is dark by default with a user-selectable light theme; the patient
  monitor does not follow the theme — it stays dark always.
- The plateau ascends slightly by design — don't flatten it.
- Baseline of the wordmark sits on the waveform baseline; keep that alignment if re-composing.
- Minimum sizes: glyph 16px tall in-tile, horizontal lockup 24px tall.
- Clear space: half the glyph height on all sides (the SVG viewBoxes already include it).
- Never place the bare yellow glyph on light surfaces — use the ink glyph, or
  the yellow breath on a mini monitor tile (`#080a08`), as the marketing-site
  header does.
- Green (`vital.ecg` `#73ef82`) is ECG grammar in the monitor UI, not the
  brand mark. Violet is an action color only; it never appears in the logo.
