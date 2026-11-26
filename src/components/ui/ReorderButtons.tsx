'use client';

import { Icon } from './Icon';

/**
 * Move up / move down / remove for one row of an ordered list. Buttons, not
 * drag-and-drop: they work with a keyboard and on a lab iPad, and need no
 * dependency. `name` finishes each button's accessible name ("Move up: Call
 * for help").
 */
export function ReorderButtons({
  name,
  index,
  count,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  count: number;
  /** Called with the row's new index. Omit for a list with no order. */
  onMove?: (to: number) => void;
  onRemove?: () => void;
}) {
  const button =
    'grid h-8 w-8 shrink-0 place-items-center rounded-ctl text-faint transition duration-150 ease-brand hover:bg-panel-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-30';
  return (
    <span className="flex shrink-0 items-center">
      {onMove && (
        <>
          <button
            type="button"
            className={button}
            disabled={index === 0}
            aria-label={`Move up: ${name}`}
            title="Move up"
            onClick={() => onMove(index - 1)}
          >
            <Icon name="arrow-up" size={15} />
          </button>
          <button
            type="button"
            className={button}
            disabled={index === count - 1}
            aria-label={`Move down: ${name}`}
            title="Move down"
            onClick={() => onMove(index + 1)}
          >
            <Icon name="arrow-down" size={15} />
          </button>
        </>
      )}
      {onRemove && (
        <button
          type="button"
          className={`${button} hover:text-red`}
          aria-label={`Remove: ${name}`}
          title="Remove"
          onClick={onRemove}
        >
          <Icon name="trash" size={15} />
        </button>
      )}
    </span>
  );
}
