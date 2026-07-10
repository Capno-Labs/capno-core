import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        monitor: {
          bg: '#05080d',
          panel: '#0b1220',
          grid: '#12203a',
        },
        vital: {
          ecg: '#22e05f',
          spo2: '#38bdf8',
          nibp: '#f87171',
          etco2: '#facc15',
          temp: '#e879f9',
          agent: '#fb923c',
        },
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
          '0%': { transform: 'scale(0.97)', boxShadow: '0 0 0 0 rgba(56, 189, 248, 0.55)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(56, 189, 248, 0)' },
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
