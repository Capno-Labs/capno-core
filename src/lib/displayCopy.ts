/**
 * Authored headlines set in the display face. They live here so one test
 * (displayCopy.test.ts) can prove every line stays inside the font subset —
 * a line outside it would silently fall back to bold sans in the browser.
 * One array entry per deliberate line break.
 */
export const DISPLAY_COPY = {
  home: ['Run the', 'case.'],
  account: ['Sign in.'],
  quickStart: ['Quick start.'],
  studentJoin: ['Join a', 'session.'],
  notFound: ['Page not', 'found.'],
  error: ['Something', 'went wrong.'],
  // Debrief walkthrough card headlines (src/lib/debrief/deckCopy.ts).
  debriefScene: ['Debrief.'],
  debriefReactions: ['How are you', 'feeling?'],
  debriefDescription: ['What', 'happened?'],
  debriefPlus: ['What went', 'well?'],
  debriefDelta: ['What would', 'you change?'],
  debriefOutstanding: ['Anything', 'outstanding?'],
  debriefTakeaways: ['Take-aways.'],
  debriefEnd: ['Debrief', 'complete.'],
} as const satisfies Record<string, readonly string[]>;
