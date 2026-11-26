'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CapnoSymbol } from '@/components/brand/CapnoSymbol';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { buildDebriefDeck } from '@/lib/debrief/deck';
import { DECK_COPY, DECK_PHASES } from '@/lib/debrief/deckCopy';
import type { ArchivedSession } from '@/lib/engine/types';
import { DeckCardView } from './DeckCardView';

/**
 * The debrief walkthrough: the session as full-screen cards, one at a time,
 * for faculty to drive on a shared screen (card order: src/lib/debrief/).
 *
 * A fixed overlay portalled to <body>, not a native <dialog>: the Fullscreen
 * API refuses dialog elements, and presenting is the point. While it is open
 * the rest of the page is made inert, so focus and the keyboard stay inside.
 *
 * Keys: → Space Enter PageDown next · ← PageUp back (clickers send the Page
 * keys) · Home/End · N facilitator cue · F fullscreen · Esc close.
 */
export function DebriefDeck({
  session,
  open,
  onClose,
  onAddTakeaway,
  endActions,
}: {
  session: ArchivedSession;
  open: boolean;
  onClose: () => void;
  /** Saves a take-away to the session. Absent = read-only (cloud archive). */
  onAddTakeaway?: (text: string) => void;
  /** Extra buttons on the closing card, before "Back to the report". */
  endActions?: ReactNode;
}) {
  const cards = useMemo(() => buildDebriefDeck(session), [session]);
  const [idx, setIdx] = useState(0);
  const [cueOpen, setCueOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Amending marks between visits can shorten the deck.
  const at = Math.min(idx, cards.length - 1);
  const card = cards[at];
  const last = at === cards.length - 1;

  const go = useCallback(
    (to: number) => setIdx(Math.max(0, Math.min(cards.length - 1, to))),
    [cards.length],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    onClose();
  }, [onClose]);

  // Own the page while open: everything else inert, no scroll behind, focus
  // inside; all of it handed back on close.
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    const madeInert = Array.from(document.body.children).filter(
      (el) => el !== root && !el.hasAttribute('inert'),
    );
    for (const el of madeInert) el.setAttribute('inert', '');
    const priorOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    root.focus({ preventScroll: true });
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === root);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      for (const el of madeInert) el.removeAttribute('inert');
      document.documentElement.style.overflow = priorOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      // Typing a take-away must never turn the page.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        if (e.key === 'Escape') target?.blur();
        return;
      }
      // A focused button or link already acts on Space/Enter.
      const activates = tag === 'BUTTON' || tag === 'A';
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      switch (key) {
        case 'ArrowRight':
        case 'PageDown':
          go(at + 1);
          break;
        case ' ':
        case 'Enter':
          if (activates) return;
          go(at + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          go(at - 1);
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(cards.length - 1);
          break;
        case 'n':
          setCueOpen((v) => !v);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          close();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, at, cards.length, go, close, toggleFullscreen]);

  if (!open || typeof document === 'undefined') return null;

  const takeaways = session.snapshot.notes
    .filter((n) => n.postHoc && n.text.startsWith(DECK_COPY.takeaways.notePrefix))
    .map((n) => n.text.slice(DECK_COPY.takeaways.notePrefix.length));

  const iconButton =
    'grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition duration-150 ease-brand hover:bg-panel-2 hover:text-ink';

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Debrief walkthrough: ${session.scenario.title}`}
      tabIndex={-1}
      data-debrief-deck
      className="no-print fixed inset-0 z-[70] flex flex-col bg-surface text-ink outline-none"
    >
      <header className="flex items-center gap-4 px-4 py-2.5 md:px-6">
        <CapnoSymbol className="h-6 w-6 shrink-0 text-logo" />
        <nav aria-label="Debrief phases" className="flex min-w-0 flex-1 items-center gap-1">
          {DECK_PHASES.map((phase) => {
            const first = cards.findIndex((c) => c.phase === phase.id);
            const current = card.phase === phase.id;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => go(first)}
                disabled={first < 0}
                aria-current={current ? 'step' : undefined}
                className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition duration-150 ease-brand ${
                  current
                    ? 'bg-brand text-white'
                    : 'hidden text-faint hover:bg-panel-2 hover:text-ink md:block'
                }`}
              >
                {phase.label}
              </button>
            );
          })}
        </nav>
        <span className="shrink-0 font-mono text-xs tabular-nums text-faint" aria-live="polite">
          {at + 1} / {cards.length}
        </span>
        <button
          type="button"
          onClick={() => setCueOpen((v) => !v)}
          aria-pressed={cueOpen}
          title="Facilitator cue (N)"
          aria-label="Facilitator cue"
          className={`${iconButton} ${cueOpen ? 'bg-panel-2 text-ink' : ''}`}
        >
          <Icon name="info" size={18} />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          title="Full screen (F)"
          aria-label="Full screen"
          className={iconButton}
        >
          <Icon name="fullscreen" size={18} />
        </button>
        <button
          type="button"
          onClick={close}
          title="Close (Esc)"
          aria-label="Close debrief"
          className={iconButton}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <div aria-hidden className="h-0.5 bg-line">
        <div
          className="h-full bg-brand transition-[width] duration-300 ease-brand"
          style={{ width: `${((at + 1) / cards.length) * 100}%` }}
        />
      </div>

      <main className="flex min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-14">
        <div
          key={card.id}
          data-card={card.id}
          data-card-kind={card.kind}
          className="m-auto w-full max-w-6xl motion-safe:animate-poster-rise"
        >
          <DeckCardView
            card={card}
            takeaway={{ takeaways, onAdd: onAddTakeaway }}
            endActions={
              <>
                {endActions}
                <Button variant={endActions ? 'secondary' : 'primary'} onClick={close}>
                  Back to the report
                </Button>
              </>
            }
          />
        </div>
      </main>

      {cueOpen && card.cue && (
        <aside className="border-t border-line bg-panel px-6 py-3 md:px-14" data-deck-cue>
          <p className="label !mb-0.5">Facilitator cue</p>
          <p className="text-sm text-ink-2 md:text-base">{card.cue}</p>
        </aside>
      )}

      <footer className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5 md:px-6">
        <Button variant="ghost" onClick={() => go(at - 1)} disabled={at === 0}>
          ← Back
        </Button>
        <p className="hidden text-xs text-faint sm:block">
          ← → to move · N facilitator cue · F full screen · Esc close
        </p>
        {last ? (
          <Button variant="primary" onClick={close}>
            Finish
          </Button>
        ) : (
          <Button variant="primary" onClick={() => go(at + 1)}>
            Next →
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
