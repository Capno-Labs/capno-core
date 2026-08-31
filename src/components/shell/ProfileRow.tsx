'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/cloud/authStore';

/** Sidebar footer: signed-in profile, or "Local device" when cloud is off.
 *  In rail mode (or below lg) only the avatar shows. */
export function ProfileRow({ rail }: { rail: boolean }) {
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.user?.email);
  const displayName = useAuthStore((s) => s.profile?.displayName);
  const role = useAuthStore((s) => s.profile?.role);
  const signedIn = status === 'signed_in';
  const name = signedIn ? displayName || email || 'Signed in' : 'Local device';
  const detail = signedIn
    ? role || email || ''
    : status === 'unconfigured'
      ? 'No cloud configured'
      : 'Not signed in';
  const initials = signedIn
    ? (displayName || email || '?')
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('')
    : '⌂';

  return (
    <Link
      href="/account"
      title={String(name)}
      className={`flex items-center gap-2.5 rounded-ctl px-2 py-2 hover:bg-panel-2 ${
        rail ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-2'
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-3 text-[11px] font-bold text-muted">
        {initials}
      </span>
      <span className={`min-w-0 leading-tight ${rail ? 'hidden' : 'hidden lg:block'}`}>
        <span className="block truncate text-xs font-bold text-ink">{name}</span>
        <span className="block truncate text-[10px] text-faint">{detail}</span>
      </span>
    </Link>
  );
}
