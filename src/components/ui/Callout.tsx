import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type CalloutTone = 'info' | 'warn' | 'danger' | 'success';

const TONE: Record<CalloutTone, { box: string; title: string; icon: IconName }> = {
  info: { box: 'bg-brand-soft ring-brand/30', title: 'text-brand-strong', icon: 'info' },
  warn: { box: 'bg-warn-soft ring-warn/40', title: 'text-warn-strong', icon: 'alert' },
  danger: { box: 'bg-red-soft ring-red/40', title: 'text-red', icon: 'alert' },
  success: { box: 'bg-green-soft ring-green/40', title: 'text-green', icon: 'check' },
};

/**
 * Inline banner for page-level context: validation, cloud state, cautions.
 * `danger` announces itself (role="alert"); the others are polite status.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  actions,
  onDismiss,
  className = '',
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons/links shown on the right (wraps below on narrow widths). */
  actions?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-ctl p-3 text-sm ring-1 ${t.box} ${className}`}
    >
      <Icon name={t.icon} size={16} className={`mt-0.5 ${t.title}`} />
      <div className="min-w-0 flex-1 text-ink-2">
        {title && <p className={`font-semibold ${t.title}`}>{title}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
