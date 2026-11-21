'use client';

import { Dialog } from '@/components/ui/Dialog';
import { useEffect, useRef, useState } from 'react';

/** Absolute student-join URL for a session (matches /student's ?code= handling). */
export function joinUrl(sessionId: string): string {
  return `${window.location.origin}/student?code=${sessionId}`;
}

/**
 * Copies the student join link, with a brief "Copied ✓" confirmation.
 * Shared by the session controls and the pre-start panel.
 */
export function CopyJoinLinkButton({
  sessionId,
  className = 'btn-ghost btn-sm',
}: {
  sessionId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl(sessionId));
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — show the
      // link so it can be selected and copied by hand.
      setManual(true);
    }
  };

  return (
    <>
      <button className={className} onClick={copy} title="Copy the student join link">
        {copied ? 'Copied ✓' : 'Copy join link'}
      </button>
      <Dialog open={manual} onClose={() => setManual(false)} title="Copy the student join link">
        <p>This browser blocked automatic copying. Select the link below and copy it.</p>
        <input
          className="input mt-3 font-mono"
          readOnly
          value={joinUrl(sessionId)}
          aria-label="Student join link"
          onFocus={(e) => e.currentTarget.select()}
          data-autofocus
        />
      </Dialog>
    </>
  );
}
