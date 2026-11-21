import type { Config } from 'tailwindcss';

// Semantic theme colors route through the CSS variables in globals.css
// (dark default, [data-theme='light'] override). RGB-triple vars keep
// Tailwind alpha modifiers (`bg-surface/95`) working.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Three-zone controller cockpit. 1440 keeps iPad Pro 12.9" landscape
      // (1366 CSS px) on the two-column layout — `xl` would cramp it.
      screens: {
        desk: '1440px',
      },
      colors: {
        surface: v('surface'),
        panel: v('panel'),
        'panel-2': v('panel-2'),
        'panel-3': v('panel-3'),
        line: v('line'),
        'line-2': v('line-2'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        muted: v('muted'),
        faint: v('faint'),
        // Brand blue — the one interactive accent, continued from capno.app.
        // `brand` is for FILLS (white text on it); `brand-strong` is the
        // text/link colour (plain brand is only 3.1:1 on the dark surface).
        brand: {
          DEFAULT: v('brand'),
          strong: v('brand-strong'),
          soft: v('brand-soft'),
          hover: v('brand-hover'),
        },
        'on-brand': '#ffffff',
        'on-brand-hover': v('on-brand-hover'),
        focus: v('focus'),
        // Caution states (orange). Amber is deliberately NOT a UI colour: it
        // is reserved for the logo mark and EtCO2 (`vital-etco2`). The guard
        // in src/lib/designGuard.test.ts fails on any `*-amber` class, because
        // with no DEFAULT here a stray `bg-amber` would compile to nothing.
        warn: { DEFAULT: v('warn'), strong: v('warn-strong'), soft: v('warn-soft') },
        'on-warn': '#0d1725',
        // Note: `extend` DEEP-merges these into Tailwind's built-in
        // green/red/cyan/violet scales, so numeric classes (`red-300`) still
        // compile with the default palette values and are NOT theme-aware.
        green: { DEFAULT: v('green'), soft: v('green-soft') },
        red: { DEFAULT: v('red'), solid: v('red-solid'), soft: v('red-soft') },
        cyan: { DEFAULT: v('cyan'), soft: v('cyan-soft') },
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        // Poster surfaces (.surface-blue / .surface-ink): theme-invariant
        // literals from the landing page.
        poster: {
          blue: '#0754f8',
          ink: '#0d1725',
          raised: '#142338',
          tint: '#f6f9fc',
          muted: '#dce7ff',
          line: '#8daeed',
        },
        // Always-dark monitor domain: literal hex on purpose — the patient
        // monitor is theme-invariant in both light and dark app themes.
        monitor: {
          bg: '#080a08',
          panel: '#11140f',
          grid: '#293027',
        },
        vital: {
          ecg: '#73ef82',
          spo2: '#38bdf8',
          nibp: '#f87171',
          etco2: '#facc15',
          temp: '#e879f9',
          agent: '#fb923c',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
        ctl: 'var(--radius-ctl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        // Inter Tight 900 caps subset, loaded in src/app/layout.tsx. Use via
        // the `.display` class; see the usage rule in globals.css.
        display: ['var(--font-display-face)', 'Arial Black', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: {
        // The landing page's single motion token.
        brand: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
      },
      keyframes: {
        'alarm-flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'char-pop': {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'crt-line': {
          '0%': { transform: 'scaleX(0)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        'crt-fade': {
          '0%': { opacity: '1' },
          '40%': { opacity: '0.6' },
          '60%': { opacity: '1' },
          '100%': { opacity: '0', visibility: 'hidden' },
        },
        'bar-grow': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '70%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // One-time headline reveal on entry screens (the landing poster's).
        'poster-rise': {
          '0%': { opacity: '0', transform: 'translateY(0.3em)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'event-fire': {
          '0%': { transform: 'scale(0.97)', boxShadow: '0 0 0 0 rgba(122, 167, 255, 0.55)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(122, 167, 255, 0)' },
        },
      },
      animation: {
        'alarm-flash': 'alarm-flash 1s ease-in-out infinite',
        'char-pop': 'char-pop 180ms ease-out',
        shake: 'shake 350ms ease-in-out',
        'crt-line': 'crt-line 450ms ease-out both',
        'crt-fade': 'crt-fade 450ms ease-in 750ms both',
        'bar-grow': 'bar-grow 600ms ease-out both',
        'pop-in': 'pop-in 400ms ease-out both',
        'event-fire': 'event-fire 350ms ease-out',
        'poster-rise': 'poster-rise 380ms cubic-bezier(0.215, 0.61, 0.355, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
