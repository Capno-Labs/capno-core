import type { ReadinessItem } from './readiness';

/**
 * "Show me": bring a checklist item's field into view and put the cursor in
 * it. The field is found the way a person would find it — by the card it is
 * in (`anchorId`) and the label above it (`field`) — so the forms need no
 * extra wiring. A closed card, "Details" row or "More" group is opened on the
 * way. Falls back to the card, then to the top of the section.
 */

const FOCUSABLE = 'input, textarea, select';

function controlOf(labelled: Element): HTMLElement | null {
  if (labelled instanceof HTMLLabelElement && labelled.htmlFor) {
    return document.getElementById(labelled.htmlFor);
  }
  if (labelled instanceof HTMLLegendElement) {
    return labelled.parentElement?.querySelector<HTMLElement>(`${FOCUSABLE}, button`) ?? null;
  }
  return labelled as HTMLElement;
}

function findByLabel(root: Element, field: string): HTMLElement | null {
  for (const el of root.querySelectorAll('label, legend, summary')) {
    const text = el.textContent?.trim() ?? '';
    // A label may carry its unit after the name ("Heart rate bpm").
    if (text === field || text.startsWith(`${field} `) || text.startsWith(field)) {
      return controlOf(el) ?? (el as HTMLElement);
    }
  }
  return null;
}

export function showField(item: Pick<ReadinessItem, 'anchorId' | 'field'>, attempt = 0): void {
  const anchor = item.anchorId ? document.getElementById(item.anchorId) : null;
  const root = anchor ?? document.querySelector('[data-editor-surface]');
  if (!root) return;

  let target = item.field ? findByLabel(root, item.field) : null;
  if (!target && anchor && attempt < 2 && (item.field || item.anchorId?.startsWith('event-'))) {
    // The field is inside a closed card or details row: open it and look again.
    const closed = anchor.querySelector<HTMLElement>('button[aria-expanded="false"]');
    if (closed) {
      closed.click();
      window.setTimeout(() => showField(item, attempt + 1), 80);
      return;
    }
  }
  target ??= anchor?.querySelector<HTMLElement>(FOCUSABLE) ?? (root as HTMLElement);

  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement) el.open = true;
  }
  if (target instanceof HTMLElement && target.tagName === 'SUMMARY') {
    (target.parentElement as HTMLDetailsElement).open = true;
  }
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (target.matches(`${FOCUSABLE}, button, summary`)) target.focus({ preventScroll: true });
}
