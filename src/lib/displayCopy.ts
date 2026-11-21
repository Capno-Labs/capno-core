/**
 * Authored headlines set in the display face. They live here so one test
 * (displayCopy.test.ts) can prove every line stays inside the font subset —
 * a line outside it would silently fall back to bold sans in the browser.
 * One array entry per deliberate line break.
 */
export const DISPLAY_COPY = {
  home: ['Run the', 'case.'],
  account: ['Sign in.'],
  studentJoin: ['Join a', 'session.'],
  notFound: ['Page not', 'found.'],
  error: ['Something', 'went wrong.'],
} as const satisfies Record<string, readonly string[]>;
