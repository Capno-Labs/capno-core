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
        // Shadowing Tailwind's built-in amber/green/red/blue/cyan scales is
        // deliberate: a missed `red-300`-style class fails loudly instead of
        // silently ignoring the theme.
        amber: { DEFAULT: v('amber'), strong: v('amber-strong'), soft: v('amber-soft') },
        green: { DEFAULT: v('green'), soft: v('green-soft') },
        red: { DEFAULT: v('red'), solid: v('red-solid'), soft: v('red-soft') },
        blue: { DEFAULT: v('blue'), soft: v('blue-soft') },
        cyan: { DEFAULT: v('cyan'), soft: v('cyan-soft') },
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
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
        'event-fire': {
          '0%': { transform: 'scale(0.97)', boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.5)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(250, 204, 21, 0)' },
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
      },
    },
  },
  plugins: [],
};

export default config;
