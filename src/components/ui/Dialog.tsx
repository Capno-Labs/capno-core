'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useDialogStore } from '@/lib/store/dialogStore';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Modal dialog on the native <dialog> element: focus trap, Escape, inert
 * background and top-layer stacking come from the platform (no dependency).
 * `variant="sheet"` docks it to the bottom edge for phone menus.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'modal',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: 'modal' | 'sheet';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first focusable (the close button); move
      // focus to the control the dialog marks as its default instead.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Fires for Escape and for el.close(); keeps `open` state honest.
      onClose={onClose}
      // A click on the backdrop targets the <dialog> itself (the panel below
      // covers its whole box), so this closes on outside-click only.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`bg-transparent p-0 text-ink backdrop:bg-poster-ink/70 backdrop:backdrop-blur-sm ${
        variant === 'sheet'
          ? 'mx-0 mb-0 mt-auto w-full max-w-none'
          : 'm-auto w-[min(92vw,30rem)]'
      }`}
    >
      {open && (
        <div
          className={`bg-panel shadow-pop ring-1 ring-line ${
            variant === 'sheet'
              ? 'rounded-t-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4'
              : 'rounded-card p-5'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition duration-150 ease-brand hover:bg-panel-2 hover:text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          {children && <div className="mt-2 text-sm text-muted">{children}</div>}
          {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Renders `confirmDialog()` requests. Mounted once in the root layout. */
export function DialogHost() {
  const request = useDialogStore((s) => s.request);
  const settle = useDialogStore((s) => s.settle);
  const danger = request?.tone === 'danger';

  return (
    <Dialog
      open={request !== null}
      onClose={() => settle(false)}
      title={request?.title ?? ''}
      footer={
        <>
          {/* Destructive confirms default to the safe choice. */}
          <Button
            variant="ghost"
            onClick={() => settle(false)}
            data-autofocus={danger ? true : undefined}
          >
            {request?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            data-autofocus={danger ? undefined : true}
          >
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {request?.body}
    </Dialog>
  );
}
