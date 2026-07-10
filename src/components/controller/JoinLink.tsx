'use client';

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
  className = 'btn-ghost !py-1 text-xs',
}: {
  sessionId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
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
      // Clipboard unavailable (permissions / non-secure context) — fall back
      // to a prompt the user can copy from manually.
      window.prompt('Copy the student join link:', joinUrl(sessionId));
    }
  };

  return (
    <button className={className} onClick={copy} title="Copy the student join link">
      {copied ? 'Copied ✓' : 'Copy join link'}
    </button>
  );
}
