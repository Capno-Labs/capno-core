// App theme: dark is the default (no attribute on <html>); light is opt-in
// via [data-theme='light']. The patient monitor ignores the theme entirely
// (always-dark monitor-* tokens). A blocking inline script in layout.tsx
// applies the stored theme before hydration so there is no flash.

export const THEME_STORAGE_KEY = 'capno:theme:v1';

export type Theme = 'dark' | 'light';

// Must equal --surface in globals.css for each theme (designGuard.test.ts checks).
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0d1725',
  light: '#f6f9fc',
};

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function getActiveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode) — theme still applies for the session.
  }
}
