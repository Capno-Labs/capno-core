'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { accountPortalUrl } from '@/lib/accountPortal';
import { useAuthStore } from '@/lib/cloud/authStore';
import { hasSeenDemo } from '@/lib/demoTour';
import {
  deriveChecklist,
  dismissOnboarding,
  markInviteOpened,
  readOnboarding,
  type Checklist,
} from '@/lib/onboarding';
import { listCustomScenarios } from '@/lib/scenarios/customStore';
import { listSessions } from '@/lib/store/sessionArchive';

/**
 * First-run checklist on the home page. Items tick themselves from what the
 * faculty member has actually done on this device; the whole card can be
 * hidden (and brought back from Settings). Renders nothing until mounted, so
 * returning users never see it flash.
 */
export function GettingStarted() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.profile?.role ?? null);
  const [list, setList] = useState<Checklist | null>(null);

  useEffect(() => {
    // While a persisted session is restoring we don't know the role yet.
    if (status === 'loading') return;
    setList(
      deriveChecklist({
        demoSeen: hasSeenDemo(),
        sessionCount: listSessions().length,
        customScenarioCount: listCustomScenarios().length,
        role: status === 'signed_in' ? role : null,
        inviteUrl: accountPortalUrl('/invites'),
        state: readOnboarding(),
      }),
    );
  }, [status, role]);

  if (!list?.visible) return null;

  return (
    <section aria-labelledby="getting-started" className="card !p-0">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2
            id="getting-started"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-strong"
          >
            Getting started
          </h2>
          <span className="font-mono text-[11px] text-faint">
            {list.doneCount} / {list.items.length} done
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            dismissOnboarding();
            setList({ ...list, visible: false });
          }}
        >
          Hide
        </button>
      </header>
      <ol className="divide-y divide-line">
        {list.items.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
            <span
              aria-hidden
              className={`display w-12 shrink-0 text-3xl ${item.done ? 'text-faint' : 'text-brand-strong'}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <h3 className={`font-bold ${item.done ? 'text-muted line-through' : ''}`}>
                {item.title}
              </h3>
              <p className="mt-0.5 text-sm text-muted">{item.body}</p>
            </div>
            {item.done ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-3 py-1.5 text-xs font-bold text-green">
                <Icon name="check" size={14} />
                Done
              </span>
            ) : (
              <Link
                href={item.href}
                className="btn-secondary shrink-0"
                {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
                onClick={
                  item.id === 'invite'
                    ? () => {
                        markInviteOpened();
                        setList(
                          deriveChecklist({
                            demoSeen: hasSeenDemo(),
                            sessionCount: listSessions().length,
                            customScenarioCount: listCustomScenarios().length,
                            role,
                            inviteUrl: accountPortalUrl('/invites'),
                            state: readOnboarding(),
                          }),
                        );
                      }
                    : undefined
                }
              >
                {item.cta}
                <span aria-hidden className="link-arrow">
                  →
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
