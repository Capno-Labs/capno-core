'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * Overflow menu on <details>/<summary>: keyboard-operable and stylable with
 * no dependency (and no Popover API, for older lab iPads). Closes on Escape,
 * outside click, and after an item is chosen.
 */
export function Menu({
  label,
  icon = 'more',
  showLabel = false,
  align = 'right',
  triggerClassName = 'btn-ghost',
  children,
}: {
  /** Accessible name of the trigger; also its visible text with `showLabel`. */
  label: string;
  icon?: IconName;
  showLabel?: boolean;
  align?: 'left' | 'right';
  triggerClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => ref.current?.removeAttribute('open');
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.open && e.target instanceof Node && !ref.current.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        close();
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative inline-block [&>summary::-webkit-details-marker]:hidden">
      <summary
        aria-label={showLabel ? undefined : label}
        title={showLabel ? undefined : label}
        className={`${triggerClassName} ${showLabel ? '' : 'btn-icon'} cursor-pointer list-none`}
      >
        <Icon name={icon} size={16} />
        {showLabel && label}
        {showLabel && <Icon name="chevron-down" size={14} />}
      </summary>
      <div
        role="menu"
        // Any chosen item closes the menu.
        onClick={() => ref.current?.removeAttribute('open')}
        className={`absolute z-40 mt-1.5 min-w-[13rem] rounded-ctl bg-panel p-1 shadow-pop ring-1 ring-line ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {children}
      </div>
    </details>
  );
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-sm font-medium transition duration-150 ease-brand';

export function MenuItem({
  icon,
  tone = 'default',
  onSelect,
  disabled = false,
  children,
}: {
  icon?: IconName;
  tone?: 'default' | 'danger';
  onSelect: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`${ITEM} disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger' ? 'text-red hover:bg-red-soft' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
      }`}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
