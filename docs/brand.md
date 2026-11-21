# CAPNO brand

## The logo: "Soft shoulder"

The symbol is a rounded square in two pieces. The open gap between them
traces one capnogram breath: a soft-shouldered upstroke, a gently ascending
plateau, a sharp downstroke. The gap is not drawn — it shows whatever
surface is behind the logo. The CAPNO lettering is outlined paths, with no
font dependency.

Four arrangements, each in four colours:

- **Horizontal** — symbol and lettering side by side. The default: site
  headers, title slides, partner materials.
- **Stacked** — lettering under the symbol, for tall or narrow layouts.
- **Symbol** — the square alone: tabs, avatars, app icons, tight spaces.
- **Wordmark** — the lettering alone, where the name stands by itself.

Colours: cobalt `#0754F8`, ink `#0D1725`, white `#FFFFFF`, black `#000000`.
**Use cobalt or ink on light surfaces and white on dark or blue ones.**
Black is for one-colour printing.

## Files

Everything comes from the Soft shoulder asset pack (the maintainers hold
the full pack, with PNG, print and motion files). Replace these from the
pack; never redraw, recolour by hand, or re-set the name in a font.

`public/brand/`:

- `capno-horizontal-{cobalt,ink,white,black}.svg`
- `capno-stacked-{cobalt,ink,white,black}.svg`
- `capno-symbol-{cobalt,ink,white,black}.svg`
- `capno-wordmark-{cobalt,ink,white,black}.svg`
- `favicon.svg` — the symbol; cobalt in a light browser theme, white in a
  dark one
- `favicon.ico` — 16, 32 and 48 px, for browsers without SVG favicons

`public/favicon.ico` is a copy of that `.ico` at the site root, for clients
that ask for `/favicon.ico` without reading the page's icon links (link
previews, feed readers). Keep the two identical.

`public/icons/` — the app icons (white symbol on cobalt): `icon-192.png`,
`icon-512.png`, the maskable `icon-192-maskable.png` and
`icon-512-maskable.png` (extra margin for the platform's mask), and
`apple-touch-icon.png`. `public/og.png` is the 1200 × 630 share card.
Installed apps cache these, so bump `VERSION` in `public/sw.js` when they
change.

In the app the logo is drawn inline so CSS can colour it:

- `src/components/brand/CapnoSymbol.tsx` — the symbol, `currentColor`
- `src/components/brand/CapnoWordmark.tsx` — the lettering, `currentColor`
- `src/components/brand/BrandMark.tsx` — the symbol at the app's sizes.
  `tone="theme"` uses the `logo` colour token (white in the dark theme,
  cobalt in the light one); `tone="white"` is for the blue poster surfaces.

The product name in the sidebar is the lettering followed by the word
"Studio" in type. The debrief report prints the symbol in black.

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
- **Amber `#facc15` is not a UI colour.** It is EtCO₂ (`vital.etco2`) —
  nothing else. It is no longer the logo's colour. There are no `amber` utility classes; a
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

- Brand blue is the accent; amber belongs to EtCO₂ only. Never colour UI
  text, buttons, pills or focus rings amber.
- Use `brand-strong`, not `brand`, for text and links.
- The app is dark by default with a user-selectable light theme; the patient
  monitor does not follow the theme — it stays dark always.
- Logo colour: cobalt or ink on light surfaces, white on dark or blue ones.
- Keep the logo on a uniform background. The waveform is an open gap, so a
  busy or two-tone background breaks the breath.
- Clear space: as a starting point, a quarter of the symbol's height on all
  sides of the combined logo.
- Don't redraw, stretch, outline or recolour the artwork, and don't re-set
  the name in a font — use the files and components above.
- Green (`vital.ecg` `#73ef82`) is ECG grammar in the monitor UI, not the
  brand mark, and not decoration elsewhere. Violet marks improvised ("added
  live") items only; it never appears in the logo.
