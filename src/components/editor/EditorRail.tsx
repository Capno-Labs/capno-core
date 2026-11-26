'use client';

import { Icon } from '@/components/ui/Icon';
import type { SectionId, SectionMeta } from './sections';

export interface SectionIssueCounts {
  errors: number;
  warnings: number;
}

/**
 * Section navigation for the case editor: numbered steps in the order a case
 * is written. A sticky vertical rail at the `desk:` (1440px) breakpoint, a
 * horizontally scrollable tab bar below it (iPad landscape). Each step shows
 * its validation-error and lint-warning counts, so a problem is visible
 * without opening the section.
 */
export function EditorRail({
  sections,
  active,
  issueCounts,
  onSelect,
}: {
  sections: SectionMeta[];
  active: SectionId;
  issueCounts: Map<SectionId, SectionIssueCounts>;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <nav
      aria-label="Editor sections"
      className="flex gap-1 overflow-x-auto pb-1 desk:sticky desk:top-[calc(var(--topbar-h)+4rem)] desk:w-56 desk:shrink-0 desk:flex-col desk:self-start desk:overflow-visible desk:pb-0"
    >
      {sections.map((s, i) => {
        const counts = issueCounts.get(s.id);
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            aria-current={isActive ? 'step' : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-ctl px-3 py-2 text-left text-sm transition duration-150 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isActive
                ? 'bg-panel-2 font-semibold text-ink ring-1 ring-line'
                : 'text-muted hover:bg-panel-2 hover:text-ink'
            }`}
            onClick={() => onSelect(s.id)}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold ${
                isActive ? 'bg-brand text-on-brand' : 'bg-panel-3 text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className="desk:flex-1">{s.label}</span>
            {counts && counts.errors > 0 && (
              <span
                className="rounded-full bg-red-soft px-1.5 py-0.5 text-[10px] font-semibold text-red ring-1 ring-red/40"
                title={`${counts.errors} thing${counts.errors === 1 ? '' : 's'} to fix`}
              >
                <span className="sr-only">To fix: </span>
                {counts.errors}
              </span>
            )}
            {counts && counts.warnings > 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn-strong ring-1 ring-warn/40"
                title={`${counts.warnings} thing${counts.warnings === 1 ? '' : 's'} worth a look`}
              >
                <Icon name="alert" size={10} />
                <span className="sr-only">Worth a look: </span>
                {counts.warnings}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
