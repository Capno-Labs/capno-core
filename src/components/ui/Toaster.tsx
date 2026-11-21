'use client';

import { useToastStore, type Toast } from '@/lib/store/toastStore';
import { Icon, type IconName } from './Icon';

const VARIANT: Record<Toast['variant'], { ring: string; icon: IconName; tint: string }> = {
  success: { ring: 'ring-green/40', icon: 'check', tint: 'text-green' },
  error: { ring: 'ring-red/40', icon: 'alert', tint: 'text-red' },
  info: { ring: 'ring-line-2', icon: 'info', tint: 'text-brand-strong' },
};

/** Fixed bottom-center toast stack. Mounted once in the root layout. On
 *  phones it sits above the bottom tab bar. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-max max-w-[92vw] -translate-x-1/2 flex-col items-center gap-2 md:bottom-5"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const v = VARIANT[t.variant];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-full bg-panel py-2 pl-3.5 pr-2 text-sm text-ink shadow-pop ring-1 motion-safe:animate-pop-in ${v.ring}`}
          >
            <Icon name={v.icon} size={16} className={v.tint} />
            <span className="min-w-0">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="link shrink-0 text-sm"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
