/**
 * Getting-started checklist on the home page. Framework-free: the pure
 * `deriveChecklist` decides what to show from facts the page gathers after
 * mount (storage, stores), so it is testable in Node.
 *
 * Two of the three items complete themselves from what the faculty member
 * actually did (ran a session, saved a case). The invite item only exists
 * when a hosted account portal is configured and the user is signed in as
 * faculty — this core has no team pages of its own.
 */

export const ONBOARDING_KEY = 'capno:onboarding:v1';

export interface OnboardingState {
  /** Set when the user hides the checklist. */
  dismissedAtIso?: string;
  /** Set when the user opens the invite page (membership isn't observable here). */
  inviteOpenedAtIso?: string;
}

export function readOnboarding(): OnboardingState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const { dismissedAtIso, inviteOpenedAtIso } = parsed as Record<string, unknown>;
    return {
      ...(typeof dismissedAtIso === 'string' ? { dismissedAtIso } : {}),
      ...(typeof inviteOpenedAtIso === 'string' ? { inviteOpenedAtIso } : {}),
    };
  } catch {
    return {};
  }
}

function writeOnboarding(next: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — the checklist simply shows again next visit.
  }
}

export function dismissOnboarding(): void {
  writeOnboarding({ ...readOnboarding(), dismissedAtIso: new Date().toISOString() });
}

/** Settings → "Show getting-started checklist". */
export function restoreOnboarding(): void {
  const { inviteOpenedAtIso } = readOnboarding();
  writeOnboarding(inviteOpenedAtIso ? { inviteOpenedAtIso } : {});
}

export function markInviteOpened(): void {
  writeOnboarding({ ...readOnboarding(), inviteOpenedAtIso: new Date().toISOString() });
}

export interface ChecklistInput {
  /** The guided demo has been opened at least once. */
  demoSeen: boolean;
  /** Archived sessions on this device. */
  sessionCount: number;
  /** Custom (authored or imported) cases on this device. */
  customScenarioCount: number;
  /** Signed-in role, or null when signed out / unconfigured. */
  role: 'student' | 'faculty' | 'admin' | null;
  /** URL of the hosted portal's invite page, or null when not configured. */
  inviteUrl: string | null;
  state: OnboardingState;
}

export interface ChecklistItem {
  id: 'demo' | 'import' | 'invite';
  title: string;
  body: string;
  cta: string;
  href: string;
  /** Opens in a new tab (leaves the app). */
  external: boolean;
  done: boolean;
}

export interface Checklist {
  /** False when dismissed, finished, or the user is a signed-in student. */
  visible: boolean;
  /** Nothing done yet: a brand-new workspace. */
  isNew: boolean;
  items: ChecklistItem[];
  doneCount: number;
}

export const DEMO_HREF = '/faculty/run/laryngospasm-lma?demo=1';

export function deriveChecklist(input: ChecklistInput): Checklist {
  const items: ChecklistItem[] = [
    {
      id: 'demo',
      title: 'Run the guided demo',
      body: 'A five-minute walkthrough of a live case: connect the student display, fire events, end into a debrief.',
      cta: 'Start the demo',
      href: DEMO_HREF,
      external: false,
      done: input.demoSeen || input.sessionCount > 0,
    },
    {
      id: 'import',
      title: 'Bring in your first case',
      body: 'Import a run sheet you already teach from, or build a case in the editor. It appears in your library.',
      cta: 'Import a run sheet',
      href: '/scenarios/import',
      external: false,
      done: input.customScenarioCount > 0,
    },
  ];
  if (input.inviteUrl && (input.role === 'faculty' || input.role === 'admin')) {
    items.push({
      id: 'invite',
      title: 'Invite your faculty',
      body: 'Create invite links for colleagues so they share the case library and the institution archive.',
      cta: 'Invite faculty',
      href: input.inviteUrl,
      external: true,
      done: Boolean(input.state.inviteOpenedAtIso),
    });
  }
  const doneCount = items.filter((i) => i.done).length;
  return {
    visible:
      !input.state.dismissedAtIso && doneCount < items.length && input.role !== 'student',
    isNew: doneCount === 0,
    items,
    doneCount,
  };
}
