'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Inline two-step confirm for destructive actions: the idle button swaps to a
 * danger "confirm" button plus a cancel. Escape or 6 seconds of inaction
 * cancels, so a stranded confirm can't linger mid-session.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn-ghost',
  disabled = false,
  title,
}: {
  label: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    const timeout = setTimeout(() => setConfirming(false), 6000);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timeout);
    };
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        className={className}
        onClick={() => setConfirming(true)}
        disabled={disabled}
        title={title}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        className="btn-danger"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button className="btn-ghost" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
