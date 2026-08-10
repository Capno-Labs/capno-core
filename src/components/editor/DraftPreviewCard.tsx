'use client';

import type { Scenario } from '@/lib/engine/types';

/**
 * Preview of a validated AI-generated draft. The draft is NOT in the editor
 * yet — faculty read the recap and explicitly load it (replacing the current
 * document, with a one-click undo in the shell) or discard it. The
 * `ai-generated` topic tag keeps the review banner up after loading.
 */
export function DraftPreviewCard({
  draft,
  onLoad,
  onDiscard,
}: {
  draft: Scenario;
  onLoad: () => void;
  onDiscard: () => void;
}) {
  const counts = [
    `${draft.phases.length} phase${draft.phases.length === 1 ? '' : 's'}`,
    `${draft.events.length} event${draft.events.length === 1 ? '' : 's'}`,
    `${draft.expectedActions.length} expected action${draft.expectedActions.length === 1 ? '' : 's'}`,
    `${draft.rubric.length} rubric categor${draft.rubric.length === 1 ? 'y' : 'ies'}`,
    `~${draft.estimatedMinutes} min`,
  ];
  return (
    <section className="card space-y-2 ring-1 !ring-sky-800">
      <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
        ✨ Draft ready — not loaded yet
      </h2>
      <p className="text-sm font-semibold text-slate-100">{draft.title}</p>
      <p className="text-sm text-slate-300">{draft.summary}</p>
      <p className="text-xs text-slate-400">{counts.join(' · ')}</p>
      <p className="text-xs text-amber-400/90">
        AI-generated content is unreviewed — after loading, check every drug effect, vital value,
        and timing before use with learners.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={onLoad}>
          Load draft into editor
        </button>
        <button className="btn-ghost" onClick={onDiscard}>
          Discard draft
        </button>
      </div>
    </section>
  );
}
