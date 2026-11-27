'use client';

import { Pill } from '@/components/ui/Pill';
import type { ReadinessItem } from './readiness';
import { SECTIONS } from './sections';

/**
 * Checklist rows: what is wrong, where, and a button that goes there.
 * `showSection` prefixes each row with its rail section — wanted on Review
 * & publish, where rows from every section sit together.
 */
export function ReadinessList({
  items,
  onShow,
  showSection = false,
}: {
  items: ReadinessItem[];
  onShow: (item: ReadinessItem) => void;
  showSection?: boolean;
}) {
  return (
    <ul className="divide-y divide-line" data-readiness>
      {items.map((item, i) => {
        const section = showSection ? SECTIONS.find((s) => s.id === item.section)?.label : undefined;
        return (
          <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
            <Pill tone={item.level === 'fix' ? 'red' : 'warn'} className="mt-0.5">
              {item.level === 'fix' ? 'Must fix' : 'Worth a look'}
            </Pill>
            <p className="min-w-[12rem] flex-1 text-sm text-ink-2">
              {(section || item.where) && (
                <span className="block font-semibold text-ink">
                  {section && <span className="font-normal text-muted">{section} · </span>}
                  {item.where}
                </span>
              )}
              {item.message}
            </p>
            {item.section && (
              <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => onShow(item)}>
                Show me
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
