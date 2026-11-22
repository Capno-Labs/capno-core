'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ActionOutcome, OutcomeStatus } from '@/lib/debrief/actionOutcomes';
import type { DeckCard } from '@/lib/debrief/deck';
import { DECK_COPY } from '@/lib/debrief/deckCopy';
import type { TurningPoint } from '@/lib/debrief/turningPoints';
import { formatClock } from '@/lib/format';

/**
 * One debrief card, sized to be read from the back of the room. Static
 * headlines use the display face (authored copy, see displayCopy.ts);
 * anything from the scenario or the session — titles, questions, action
 * labels — is bold sans, because the display font is a subset.
 */

export const STATUS_LABEL: Record<OutcomeStatus, string> = {
  done: 'Done',
  delayed: 'Delayed',
  incorrect: 'Incorrect',
  missed: 'Not done',
};

const STATUS_CHIP: Record<OutcomeStatus, string> = {
  done: 'bg-green-soft text-green ring-green/40',
  delayed: 'bg-warn-soft text-warn-strong ring-warn/40',
  incorrect: 'bg-red-soft text-red ring-red/40',
  missed: 'bg-red-soft text-red ring-red/40',
};

const SEVERITY_CLASS: Record<TurningPoint['severity'], string> = {
  info: 'text-ink-2',
  warning: 'text-warn-strong',
  critical: 'text-red',
};

function StatusChip({ status }: { status: OutcomeStatus }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-3 py-1 font-mono text-[0.7em] font-semibold uppercase tracking-[0.12em] ring-1 ${STATUS_CHIP[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
      <span aria-hidden className="h-px w-10 bg-brand-strong" />
      {children}
    </p>
  );
}

function DisplayLines({ lines, small = false }: { lines: readonly string[]; small?: boolean }) {
  return (
    <h2
      className={`display ${
        small ? 'text-[clamp(2.25rem,5.5vw,5rem)]' : 'text-[clamp(3rem,9vw,8rem)]'
      }`}
    >
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </h2>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[clamp(1.75rem,3.6vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] [text-wrap:balance]">
      {children}
    </h2>
  );
}

function Prompts({ prompts }: { prompts: readonly string[] }) {
  return (
    <ul className="mt-8 space-y-2 text-[clamp(1.125rem,2.2vw,2rem)] leading-snug text-ink-2">
      {prompts.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

const BODY = 'text-[clamp(1.0625rem,1.75vw,1.625rem)] leading-snug';

function OutcomeRow({ outcome, showStatus }: { outcome: ActionOutcome; showStatus: boolean }) {
  return (
    <li className="flex items-start gap-4 border-b border-line py-3 last:border-b-0">
      {showStatus ? (
        <span className="mt-0.5 text-base">
          <StatusChip status={outcome.status} />
        </span>
      ) : (
        <span className="mt-1 text-green">
          <Icon name="check" size={24} />
        </span>
      )}
      <span className="min-w-0 flex-1">{outcome.action.label}</span>
      {outcome.markedAtSec !== undefined && (
        <span className="shrink-0 font-mono tabular-nums text-faint">
          {formatClock(outcome.markedAtSec)}
        </span>
      )}
    </li>
  );
}

export interface TakeawayProps {
  /** Take-aways already captured for this session. */
  takeaways: string[];
  /** Absent for a read-only session (institution archive). */
  onAdd?: (text: string) => void;
}

function Takeaways({ takeaways, onAdd }: TakeawayProps) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text || !onAdd) return;
    onAdd(text);
    setDraft('');
  };
  return (
    <div>
      <DisplayLines lines={DECK_COPY.takeaways.headline} small />
      <Prompts prompts={DECK_COPY.takeaways.prompts} />
      {takeaways.length > 0 && (
        <ol className={`mt-8 list-decimal space-y-2 pl-8 font-semibold ${BODY}`}>
          {takeaways.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
      {onAdd && (
        <div className="mt-8 flex max-w-3xl gap-3">
          <input
            className="input !py-3 !text-lg"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Type a take-away as the learners say it…"
            aria-label="Add a take-away"
          />
          <Button variant="secondary" onClick={add} disabled={draft.trim() === ''}>
            Add
          </Button>
        </div>
      )}
      {onAdd && (
        <p className="mt-2 text-sm text-faint">Saved to the report under faculty notes.</p>
      )}
    </div>
  );
}

export function DeckCardView({
  card,
  takeaway,
  endActions,
}: {
  card: DeckCard;
  takeaway: TakeawayProps;
  /** Buttons for the closing card. */
  endActions?: ReactNode;
}) {
  switch (card.kind) {
    case 'scene':
      return (
        <div>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.14em] text-faint">
            {DECK_COPY.disclaimer}
          </p>
          <DisplayLines lines={DECK_COPY.scene.headline} />
          <p className="mt-6 text-[clamp(1.5rem,3vw,2.75rem)] font-bold leading-tight tracking-[-0.02em] [text-wrap:balance]">
            {card.title}
          </p>
          {card.learners.length > 0 && (
            <p className={`mt-2 text-muted ${BODY}`}>{card.learners.join(', ')}</p>
          )}
          <div className={`mt-8 space-y-1 text-ink-2 ${BODY}`}>
            {DECK_COPY.scene.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <ol className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-base md:text-lg">
            {DECK_COPY.scene.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-mono text-sm font-bold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-10 text-xs text-faint">{DECK_COPY.attribution}</p>
        </div>
      );

    case 'prompt':
      return (
        <div>
          <DisplayLines lines={card.headline} />
          <Prompts prompts={card.prompts} />
        </div>
      );

    case 'timeline':
      return (
        <div>
          <Kicker>{DECK_COPY.timeline.eyebrow}</Kicker>
          <Heading>{DECK_COPY.timeline.heading}</Heading>
          <ol className={`mt-6 ${BODY}`}>
            {card.points.map((p, i) => (
              <li key={i} className="flex gap-5 border-b border-line py-2.5 last:border-b-0">
                <span className="w-[4.5ch] shrink-0 font-mono tabular-nums text-faint">
                  {formatClock(p.t)}
                </span>
                <span className={`min-w-0 ${SEVERITY_CLASS[p.severity]}`}>{p.label}</span>
              </li>
            ))}
          </ol>
          {card.omitted > 0 && (
            <p className="mt-4 text-sm text-faint">
              {card.omitted} more in the full report timeline.
            </p>
          )}
        </div>
      );

    case 'list':
      return (
        <div>
          <Kicker>
            {card.eyebrow}
            {card.part && ` · ${card.part.n} of ${card.part.of}`}
          </Kicker>
          <Heading>{card.heading}</Heading>
          <ol className={`mt-6 space-y-4 ${BODY}`}>
            {card.items.map((item, i) => (
              <li key={i} className="flex gap-5">
                <span className="w-[2ch] shrink-0 text-right font-mono font-semibold tabular-nums text-brand-strong">
                  {card.start + i}
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'plusDelta':
      return (
        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          {[DECK_COPY.plusDelta.plus, DECK_COPY.plusDelta.delta].map((lines) => (
            <div key={lines.join(' ')}>
              <DisplayLines lines={lines} small />
              <p className="mt-5 text-[clamp(1.125rem,2.2vw,2rem)] text-ink-2">
                {DECK_COPY.plusDelta.why}
              </p>
            </div>
          ))}
        </div>
      );

    case 'doneWell':
      return (
        <div>
          <Kicker>{DECK_COPY.doneWell.eyebrow}</Kicker>
          <Heading>{DECK_COPY.doneWell.heading}</Heading>
          <ul className={`mt-6 ${BODY}`}>
            {card.outcomes.map((o) => (
              <OutcomeRow key={o.action.id} outcome={o} showStatus={false} />
            ))}
          </ul>
        </div>
      );

    case 'gap': {
      const o = card.outcome;
      return (
        <div>
          <Kicker>
            {DECK_COPY.gap.eyebrow}
            {card.of > 1 && ` · ${card.n} of ${card.of}`}
          </Kicker>
          <div className="mb-4 text-base md:text-lg">
            <StatusChip status={o.status} />
          </div>
          <Heading>{o.action.label}</Heading>
          {o.action.description && (
            <p className={`mt-4 whitespace-pre-wrap text-muted ${BODY}`}>{o.action.description}</p>
          )}
          {(o.triggeredAtSec !== undefined || o.markedAtSec !== undefined) && (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-base md:text-lg">
              {o.triggeredAtSec !== undefined && (
                <div>
                  <dt className="label">In the case</dt>
                  <dd>
                    <span className="font-mono tabular-nums text-faint">
                      {formatClock(o.triggeredAtSec)}
                    </span>{' '}
                    {o.triggerLabel}
                  </dd>
                </div>
              )}
              {o.markedAtSec !== undefined && (
                <div>
                  <dt className="label">Marked</dt>
                  <dd>
                    <span className="font-mono tabular-nums text-faint">
                      {formatClock(o.markedAtSec)}
                    </span>{' '}
                    {STATUS_LABEL[o.status].toLowerCase()}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <Prompts prompts={DECK_COPY.gap.prompts} />
        </div>
      );
    }

    case 'otherGaps':
      return (
        <div>
          <Kicker>{DECK_COPY.otherGaps.eyebrow}</Kicker>
          <Heading>{DECK_COPY.otherGaps.heading}</Heading>
          <ul className={`mt-6 ${BODY}`}>
            {card.outcomes.map((o) => (
              <OutcomeRow key={o.action.id} outcome={o} showStatus />
            ))}
          </ul>
        </div>
      );

    case 'question':
      return (
        <div>
          <Kicker>
            {DECK_COPY.question.eyebrow} · {card.n} of {card.of}
          </Kicker>
          <p className="text-[clamp(1.75rem,4vw,3.75rem)] font-bold leading-[1.12] tracking-[-0.03em] [text-wrap:balance]">
            {card.text}
          </p>
        </div>
      );

    case 'takeaways':
      return <Takeaways {...takeaway} />;

    case 'end':
      return (
        <div>
          <DisplayLines lines={DECK_COPY.end.headline} />
          {takeaway.takeaways.length > 0 && (
            <ol className={`mt-8 list-decimal space-y-2 pl-8 ${BODY}`}>
              {takeaway.takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          )}
          {endActions && <div className="mt-10 flex flex-wrap gap-3">{endActions}</div>}
        </div>
      );
  }
}
