'use client';

import type { SectionId, SectionMeta } from './sections';

export interface SectionIssueCounts {
  errors: number;
  warnings: number;
}

/**
 * Section navigation for the case editor: a sticky vertical rail at the
 * `desk:` (1440px) breakpoint, a horizontally scrollable tab bar below it
 * (iPad landscape). Badges show each section's validation-error and lint-
 * warning counts so problems in a section are visible without opening it.
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
      className="flex gap-1 overflow-x-auto pb-1 desk:sticky desk:top-14 desk:w-52 desk:shrink-0 desk:flex-col desk:self-start desk:overflow-visible desk:pb-0"
    >
      {sections.map((s) => {
        const counts = issueCounts.get(s.id);
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            aria-current={isActive ? 'true' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition duration-150 ${
              isActive
                ? 'bg-slate-800 font-semibold text-slate-100 ring-1 ring-slate-700'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
            onClick={() => onSelect(s.id)}
          >
            <span className="desk:flex-1">{s.label}</span>
            {counts && counts.errors > 0 && (
              <span
                className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-800"
                title={`${counts.errors} validation issue${counts.errors === 1 ? '' : 's'}`}
              >
                {counts.errors}
              </span>
            )}
            {counts && counts.warnings > 0 && (
              <span
                className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-amber-800"
                title={`${counts.warnings} authoring warning${counts.warnings === 1 ? '' : 's'}`}
              >
                ⚠ {counts.warnings}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
