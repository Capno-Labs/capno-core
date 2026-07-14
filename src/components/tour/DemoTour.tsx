'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { DEMO_TOUR_STEPS, markDemoSeen } from '@/lib/demoTour';

const CARD_W = 320;
/** Rough card height used only to decide whether to flip above the anchor. */
const CARD_H_ESTIMATE = 220;
const GAP = 12;

/**
 * Hand-rolled coach marks for the guided demo (no tour library — invariant
 * 6). The page stays fully interactive: no backdrop, and the highlight ring
 * is pointer-events-none. Closing by any route (Finish, Skip, Esc) persists
 * the seen flag so the tour only self-opens once.
 *
 * Keyboard: Esc closes from anywhere; Enter/arrows navigate only while the
 * card owns focus, so the cockpit's Space/N shortcuts keep working.
 */
export function DemoTour({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = DEMO_TOUR_STEPS[idx];
  const last = idx === DEMO_TOUR_STEPS.length - 1;

  const close = useCallback(() => {
    markDemoSeen();
    onClose();
  }, [onClose]);

  // Find and track the step's anchor. Missing anchors (conditional controls,
  // future drift) fall back to a centered card — the tour never strands.
  useEffect(() => {
    const el = step.anchor ? document.querySelector(step.anchor) : null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    let raf = 0;
    const measure = () => {
      raf = 0;
      setRect(el.getBoundingClientRect());
    };
    measure();
    const onMove = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Re-measure while the smooth scroll settles, then stop polling.
    const settle = window.setInterval(measure, 200);
    const stop = window.setTimeout(() => window.clearInterval(settle), 1500);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(settle);
      window.clearTimeout(stop);
    };
  }, [step]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const next = () => (last ? close() : setIdx((i) => i + 1));
  const back = () => setIdx((i) => Math.max(0, i - 1));

  // Below `sm` the card is a bottom sheet; anchored cards sit under their
  // target (flipped above when there's no room), clamped to the viewport.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  let cardClass = 'fixed z-50';
  let cardStyle: CSSProperties | undefined;
  if (narrow) {
    cardClass += ' inset-x-0 bottom-0 rounded-t-xl';
  } else if (rect) {
    const flip = rect.bottom + GAP + CARD_H_ESTIMATE > window.innerHeight;
    cardClass += ' rounded-xl';
    cardStyle = {
      width: CARD_W,
      left: Math.max(GAP, Math.min(rect.left, window.innerWidth - CARD_W - GAP)),
      ...(flip
        ? { bottom: Math.max(GAP, window.innerHeight - rect.top + GAP) }
        : { top: rect.bottom + GAP }),
    };
  } else {
    cardClass += ' left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl';
    cardStyle = { width: CARD_W, maxWidth: 'calc(100vw - 24px)' };
  }

  return (
    <>
      {rect && !narrow && (
        <div
          className="pointer-events-none fixed z-40 rounded-lg ring-2 ring-sky-400"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Demo tour: ${step.title}`}
        tabIndex={-1}
        className={`${cardClass} border border-sky-800 bg-slate-900 p-4 shadow-2xl outline-none`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'ArrowRight') {
            e.preventDefault();
            next();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            back();
          }
        }}
      >
        <p className="text-[10px] uppercase tracking-wider text-sky-400">
          Demo tour · {idx + 1} / {DEMO_TOUR_STEPS.length}
        </p>
        <h2 className="mt-1 text-sm font-bold text-slate-100">{step.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button className="text-xs text-slate-500 hover:text-slate-300" onClick={close}>
            Skip tour
          </button>
          <span className="flex gap-2">
            {idx > 0 && (
              <button className="btn-ghost text-xs" onClick={back}>
                ← Back
              </button>
            )}
            <button className="btn-primary !py-1 text-xs" onClick={next}>
              {last ? 'Finish' : 'Next →'}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
