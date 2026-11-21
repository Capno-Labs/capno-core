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

The app continues the capno.app landing page: the same navy ink, the same
brand blue, the same display face. It ships two themes — **dark is the
default**, light is a user toggle — driven by the CSS variables in
`src/app/globals.css`. The patient monitor is always dark in both themes.

Semantic neutrals (dark / light):

- Surface `#0d1725` / `#f6f9fc` — page background (also manifest + site theme color)
- Panel `#142338` / `#ffffff`, inset panel `#1c2f4a` / `#eef3f8`
- Line `#2b4366` / `#dbe3ec` — borders, rings, dividers
- Ink `#f4f7fb` / `#0a2540`, muted `#b8c5d8` / `#425466`

Accent, status and monitor:

- **Brand blue `#0754f8` is the one interactive accent** (Tailwind `brand`):
  primary buttons, active navigation, selected chips. It is a FILL colour —
  white text on it is 5.8:1. Brand-as-text uses `brand-strong` (`#7aa7ff`
  on dark, `#0754f8` on light): plain brand blue is only 3.1:1 on the dark
  surface.
- **Caution is orange** (Tailwind `warn`, `#f97316`; text uses
  `warn-strong`): pending sync, delayed actions, imminent automatic events,
  authoring warnings. Alarm and error states stay red.
- **Amber `#facc15` is not a UI colour.** It is the mark's colour and EtCO₂
  (`vital.etco2`) — nothing else. There are no `amber` utility classes; a
  test (`src/lib/designGuard.test.ts`) fails the build if one appears.
- Monitor black `#080a08` (Tailwind `monitor.bg`; tile fill) — theme-invariant
- ECG green `vital.ecg` `#73ef82`

## Type

- Body and UI text use the system UI stack.
- Labels and eyebrows are monospace, uppercase, widely tracked.
- Headlines on entry screens use the **display face**: Inter Tight 900
  (OFL), self-hosted in `src/fonts/` as a ~4 KB subset — capitals, digits and
  `! & ' ( ) , - . / : ; ?` only. It is for static, authored copy
  (`src/lib/displayCopy.ts`) and never for scenario titles, names, emails
  or other user data; `src/lib/displayType.ts` holds the glyph set and a
  test keeps authored headlines inside it.

## Surfaces and motion

- Poster surfaces (`.surface-blue`, `.surface-ink`: the landing page's blue
  field and ink band, with print grain) are for entry screens — home,
  account, student join, empty states, 404/error. They never appear inside
  the live controller, and they are removed in print.
- Buttons are pills. The primary's hover is a colour swap, not a lift.
- One easing (`ease-brand`, 150 ms) for every hover; a single short headline
  rise on entry screens. All decorative motion is off under
  `prefers-reduced-motion`; the alarm flash stays (it is a safety cue).

## Rules

- Brand blue is the accent; amber belongs to the mark and EtCO₂ only. Never
  colour UI text, buttons, pills or focus rings amber.
- Use `brand-strong`, not `brand`, for text and links.
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
  brand mark, and not decoration elsewhere. Violet marks improvised ("added
  live") items only; it never appears in the logo.
