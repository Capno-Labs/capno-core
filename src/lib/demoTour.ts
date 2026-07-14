/**
 * Guided demo tour: step definitions and the "seen" flag.
 *
 * Framework-free so the step data is testable in Node. Steps anchor to
 * `data-tour` attributes on the run-page cockpit; a null anchor renders the
 * coach mark centered. Copy is UI guidance only — clinical narration stays
 * in the scenario's own reviewed text (invariant 7).
 */

export const DEMO_SEEN_KEY = 'capno:demo:v1';

export interface DemoTourStep {
  id: string;
  /** CSS selector for the element to highlight; null = centered card. */
  anchor: string | null;
  title: string;
  body: string;
}

export const DEMO_TOUR_STEPS: readonly DemoTourStep[] = [
  {
    id: 'welcome',
    anchor: null,
    title: 'Welcome to the faculty controller',
    body:
      'This two-minute tour shows the loop: connect a student display, start the ' +
      'session, pace events, drive the vitals, mark learner actions, and end in a ' +
      'scored debrief. The page stays live — try things as you go.',
  },
  {
    id: 'connect',
    anchor: '[data-tour="connect"]',
    title: 'Connect the student display',
    body:
      'Students watch a mirrored monitor. Open the student display in another tab ' +
      '(Copy join link or Open display ↗) — it joins with this 4-character code. ' +
      'Tabs of this browser connect instantly; other devices need the cloud backend.',
  },
  {
    id: 'start',
    anchor: '[data-tour="start"]',
    title: 'Start the session',
    body:
      'Start (or the spacebar) begins the clock. Nothing fires on its own unless ' +
      'you turn Auto events on — you set the pace.',
  },
  {
    id: 'flow',
    anchor: '[data-tour="flow"]',
    title: 'Pace the case from the Flow panel',
    body:
      'Scenario events in narrative order, each with its linked learner actions. ' +
      'The highlighted card is next up — fire it with its button or the N key, pin ' +
      'a different card to make it next, or add an ad-hoc event.',
  },
  {
    id: 'vitals',
    anchor: '[data-tour="vitals"]',
    title: 'Drive the physiology',
    body:
      'Sliders ramp vitals over the selected transition time; presets bundle ' +
      'common patterns. Every change shows up on the student monitor.',
  },
  {
    id: 'mark-actions',
    anchor: '[data-tour="flow"]',
    title: 'Mark learner actions as you observe them',
    body:
      'Each event card lists its expected actions — one tap marks Observed, ' +
      'Delayed, Incorrect, or Missed. Any mark can be amended later in the debrief.',
  },
  {
    id: 'end',
    anchor: '[data-tour="end"]',
    title: 'End into a debrief',
    body:
      'End session archives the run on this device and opens the scored, ' +
      'printable debrief report.',
  },
  {
    id: 'finish',
    anchor: null,
    title: "That's the loop",
    body:
      'Case library → run → debrief. Keep exploring this demo case, and restart ' +
      'the walkthrough anytime from the Restart tour button in the top bar.',
  },
];

export function hasSeenDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEMO_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function markDemoSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DEMO_SEEN_KEY,
      JSON.stringify({ seenAtIso: new Date().toISOString() }),
    );
  } catch {
    // Storage unavailable — the tour will simply offer itself again.
  }
}
