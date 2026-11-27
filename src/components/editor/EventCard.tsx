'use client';

import { CATEGORY_DOT, CATEGORY_LABELS } from '@/components/eventCategories';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { ReorderButtons } from '@/components/ui/ReorderButtons';
import type { LintWarning } from '@/lib/engine/lint';
import type { ExpectedAction, Phase, ScenarioEvent } from '@/lib/engine/types';
import { describeEvent, describeTrigger } from '@/lib/scenarios/progression';
import { EventFields } from './EventFields';

/**
 * One thing that happens in the case. Closed, it reads as a sentence: what,
 * when, and what it does to the monitor. Open, it is the whole form for that
 * event. Presentational: ordering, ids and the trigger-time memory live in
 * ProgressionSection.
 */
export function EventCard({
  event,
  open,
  position,
  count,
  phases,
  actions,
  warnings,
  onToggle,
  onChange,
  onLabel,
  onSetAuto,
  onMove,
  onRemove,
  onDuplicate,
  onSaveToLibrary,
}: {
  event: ScenarioEvent;
  open: boolean;
  /** Place among the events shown with it, for the move buttons. */
  position: number;
  count: number;
  phases: Phase[];
  /** The case's expected actions, offered as links. */
  actions: ExpectedAction[];
  /** Lint messages about this event. */
  warnings: LintWarning[];
  onToggle: () => void;
  onChange: (patch: Partial<ScenarioEvent>) => void;
  onLabel: (label: string) => void;
  onSetAuto: (auto: boolean) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
}) {
  const title = event.label || 'Untitled';
  const auto = event.autoAtSec !== undefined;

  return (
    <li
      id={`event-${event.id}`}
      className={`scroll-mt-40 rounded-ctl ring-1 transition duration-150 ease-brand ${
        open ? 'bg-panel-2 ring-line-2' : 'bg-panel-2/60 ring-line hover:bg-panel-2'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 rounded-ctl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onToggle}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[event.category]}`}
          title={CATEGORY_LABELS[event.category]}
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${event.label ? 'text-ink' : 'text-faint'}`}>{title}</span>
          <span className="mt-0.5 block text-xs text-muted">
            <span className={auto ? 'font-semibold text-brand-strong' : 'font-semibold text-ink-2'}>
              {describeTrigger(event)}
            </span>
            <span className="text-faint"> · </span>
            {describeEvent(event)}
          </span>
        </span>
        {warnings.length > 0 && (
          <span
            className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn-strong ring-1 ring-warn/40"
            title={`${warnings.length} thing${warnings.length === 1 ? '' : 's'} worth a look`}
          >
            <Icon name="alert" size={10} />
            {warnings.length}
          </span>
        )}
        <Icon
          name="chevron-down"
          size={16}
          className={`mt-0.5 shrink-0 text-faint transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
          {warnings.length > 0 && (
            <Callout tone="warn" title="Worth a look">
              <ul className="list-disc space-y-0.5 pl-4">
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </Callout>
          )}
          <EventFields
            event={event}
            phases={phases}
            actions={actions}
            onChange={onChange}
            onLabel={onLabel}
            onSetAuto={onSetAuto}
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button type="button" className="btn-ghost btn-sm" onClick={onDuplicate}>
              <Icon name="copy" size={14} /> Duplicate
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={onSaveToLibrary}
              title="Keep a copy in My events to reuse in other cases"
            >
              <Icon name="save" size={14} /> Save to My events
            </button>
            <span className="ml-auto">
              <ReorderButtons
                name={title}
                index={position}
                count={count}
                onMove={(to) => onMove(to < position ? -1 : 1)}
                onRemove={onRemove}
              />
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
