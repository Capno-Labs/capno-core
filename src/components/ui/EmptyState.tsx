import type { ReactNode } from 'react';
import { isDisplaySafe } from '@/lib/displayType';
import { Icon, type IconName } from './Icon';

/**
 * Empty / not-found state: says what's missing and offers the next step.
 * A display-safe string title renders in the display face.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  className = '',
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-card bg-panel/60 px-6 py-12 text-center ring-1 ring-line ${className}`}
    >
      {icon && (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-strong">
          <Icon name={icon} size={20} />
        </span>
      )}
      <h2 className={isDisplaySafe(title) ? 'display text-2xl md:text-3xl' : 'text-xl font-bold'}>
        {title}
      </h2>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
