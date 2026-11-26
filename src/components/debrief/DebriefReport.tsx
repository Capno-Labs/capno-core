'use client';

import { useMemo, useState } from 'react';
import { CapnoSymbol } from '@/components/brand/CapnoSymbol';
import { deriveActionOutcomes } from '@/lib/debrief/actionOutcomes';
import { deriveTurningPoints, type TurningPoint } from '@/lib/debrief/turningPoints';
import type { ActionStatus, ArchivedSession, FacultyNote, LogEntry } from '@/lib/engine/types';

function fmt(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

/** Post-hoc amendment hooks; when provided, the report becomes editable. */
export interface DebriefAmend {
  markAction: (actionId: string, status: ActionStatus) => void;
  setLearners: (names: string[]) => void;
  setNotes: (notes: FacultyNote[]) => void;
}

const AMENDABLE_STATUSES: ActionStatus[] = ['done', 'delayed', 'incorrect', 'missed'];

/** Status word color in the learner-action grid (pending renders as missed). */
const ACTION_STATUS_CLASS: Record<Exclude<ActionStatus, 'pending'>, string> = {
  done: 'text-green',
  delayed: 'text-warn-strong',
  incorrect: 'text-red',
  missed: 'text-muted',
};

const SEVERITY_CLASS: Record<TurningPoint['severity'], string> = {
  info: 'text-ink-2',
  warning: 'text-warn-strong',
  critical: 'text-red',
};

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  session: 'Session',
  phase: 'Phase',
  event: 'Event',
  vital_change: 'Vitals',
  action: 'Action',
  note: 'Note',
  alarm: 'Alarm',
};

/**
 * The written debrief record: where faculty check the marks and notes before
 * the walkthrough (DebriefDeck), and what prints. It reports what happened
 * and what was marked — no score and no vitals graph; the walkthrough is
 * where the debrief itself happens.
 *
 * On screen it uses the app theme; the
 * `.print-report` styles in globals.css convert it to a clean black-on-white
 * document for the browser's Print → Save as PDF flow.
 */
export function DebriefReport({
  session,
  amend,
}: {
  session: ArchivedSession;
  amend?: DebriefAmend;
}) {
  const { scenario, snapshot } = session;
  const [learnersDraft, setLearnersDraft] = useState<string | null>(null);
  // Note editing: which note is being edited ('new' = adding) and its draft text.
  const [noteDraft, setNoteDraft] = useState<{ idx: number | 'new'; text: string } | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  const saveNoteDraft = () => {
    if (!amend || noteDraft === null) return;
    const text = noteDraft.text.trim();
    if (text) {
      amend.setNotes(
        noteDraft.idx === 'new'
          ? [...snapshot.notes, { t: snapshot.elapsedSec, text, postHoc: true }]
          : snapshot.notes.map((n, i) => (i === noteDraft.idx ? { ...n, text } : n)),
      );
    }
    setNoteDraft(null);
  };
  const turningPoints = useMemo(() => deriveTurningPoints(session), [session]);
  const outcomes = useMemo(() => deriveActionOutcomes(session), [session]);

  // No points anywhere ⇒ an imported checklist: its rows carry the program's
  // own rubric descriptors, which the action table shows in place of nothing.
  const importedRubric = scenario.expectedActions.every((a) => a.points === 0);
  const statusCount = (status: ActionStatus) => outcomes.filter((o) => o.status === status).length;
  const doneCount = statusCount('done');
  const delayedCount = statusCount('delayed');
  const incorrectCount = statusCount('incorrect');
  const notDoneCount = statusCount('missed');
  const criticalDone = outcomes.filter((o) => o.action.critical && o.status === 'done');
  const criticalMissed = outcomes.filter((o) => o.action.critical && o.status !== 'done');

  return (
    <article className="print-report card space-y-8 !p-6 md:!p-8">
      {/* Header */}
      <header className="border-b border-line pb-4">
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-faint">
          <CapnoSymbol className="h-4 w-4 shrink-0" />
          CAPNO Studio debrief report · simulation only — not a clinical record
        </p>
        <h1 className="mt-1 text-2xl font-bold">{scenario.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Session {session.sessionId} · {new Date(session.endedAtIso).toLocaleString()} · duration{' '}
          {fmt(snapshot.elapsedSec)} · {scenario.patient.name}, {scenario.patient.age}
          {scenario.patient.sex === 'male' ? 'M' : 'F'}, ASA {scenario.patient.asa}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          <span className="font-semibold">Learners:</span>{' '}
          {session.learnerNames?.length ? session.learnerNames.join(', ') : '—'}
          {amend && learnersDraft === null && (
            <button
              className="no-print ml-2 text-xs text-brand-strong hover:underline"
              onClick={() => setLearnersDraft(session.learnerNames?.join(', ') ?? '')}
            >
              edit
            </button>
          )}
        </p>
        {amend && learnersDraft !== null && (
          <div className="no-print mt-2 flex max-w-md gap-2">
            <input
              className="input"
              placeholder="Comma-separated learner names"
              value={learnersDraft}
              onChange={(e) => setLearnersDraft(e.target.value)}
              autoFocus
            />
            <button
              className="btn-secondary shrink-0"
              onClick={() => {
                amend.setLearners(
                  learnersDraft
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean),
                );
                setLearnersDraft(null);
              }}
            >
              Save
            </button>
          </div>
        )}
      </header>

      {/* What the case set out to teach — the frame for everything below. */}
      {scenario.learningObjectives.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Learning objectives</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {scenario.learningObjectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      {/* What happened: the timeline */}
      <section>
        <h2 className="mb-2 text-lg font-bold">What happened</h2>
        <h3 className="label mb-1">Timeline</h3>
        <table className="w-full text-sm">
          <tbody>
            {snapshot.log
              .filter((e) => e.kind !== 'vital_change' || snapshot.log.length < 80)
              .map((e, i) => (
                <tr key={i} className="border-b border-line align-top">
                  <td className="w-14 py-1 font-mono tabular-nums text-faint">{fmt(e.t)}</td>
                  <td className="w-20 py-1 text-xs uppercase text-faint">{KIND_LABEL[e.kind]}</td>
                  <td className="py-1">
                    {e.label}
                    {e.detail && <span className="text-faint"> — {e.detail}</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* Key clinical turning points */}
      {turningPoints.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Key clinical turning points</h2>
          <ul className="space-y-1 text-sm">
            {turningPoints.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 shrink-0 font-mono tabular-nums text-faint">
                  {fmt(p.t)}
                </span>
                <span className={SEVERITY_CLASS[p.severity]}>
                  {p.label}
                  {p.detail && <span className="text-faint"> — {p.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions taken */}
      <section>
        <h2 className="mb-2 text-lg font-bold">What the learner did</h2>
        <p className="mb-2 text-sm text-ink-2" data-action-counts>
          {doneCount} of {scenario.expectedActions.length} expected actions done
          {delayedCount > 0 ? `, ${delayedCount} delayed` : ''}
          {incorrectCount > 0 ? `, ${incorrectCount} incorrect` : ''}
          {notDoneCount > 0 ? `, ${notDoneCount} not done` : ''}.
        </p>
        {amend && (
          <p className="no-print mb-2 text-xs text-faint">
            Live marking is hard mid-scenario — amend any status below; changes save immediately
            and carry into the walkthrough.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="py-1.5 pr-3 font-semibold">Action</th>
                <th className="py-1.5 pr-3 font-semibold">Phase</th>
                <th className="py-1.5 pr-3 font-semibold">Marked</th>
                <th className="py-1.5 pr-3 font-semibold">Status</th>
                {importedRubric && <th className="py-1.5 font-semibold">Rubric descriptors</th>}
              </tr>
            </thead>
            <tbody>
              {outcomes.map(({ action: a, status: shown, markedAtSec, phaseLabel }) => {
                return (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-1.5 pr-3" title={a.description}>
                      {a.critical && (
                        <span className="mr-1 text-red" title="critical action">
                          ●
                        </span>
                      )}
                      {a.label}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-faint">
                      {phaseLabel ?? '—'}
                    </td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-faint">
                      {markedAtSec !== undefined ? fmt(markedAtSec) : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={`font-semibold uppercase ${ACTION_STATUS_CLASS[shown]}`}>
                        {shown}
                      </span>
                      {amend && (
                        <select
                          className="no-print ml-2 rounded-ctl bg-panel-2 px-1 py-0.5 text-xs text-ink-2 ring-1 ring-line"
                          value={shown}
                          onChange={(e) => amend.markAction(a.id, e.target.value as ActionStatus)}
                          aria-label={`Amend status for ${a.label}`}
                        >
                          {AMENDABLE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    {importedRubric && (
                      <td className="max-w-md whitespace-pre-wrap py-1.5 text-xs text-ink-2">
                        {a.description ?? '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Critical actions, promoted (an imported checklist with no critical
          rows has nothing to promote — and "all 0 completed" would mislead). */}
      {criticalDone.length + criticalMissed.length > 0 && (
      <section>
        <h2 className="mb-2 text-lg font-bold">Missed or delayed critical actions</h2>
        {criticalMissed.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {criticalMissed.map(({ action: a, status }) => (
              <li key={a.id} className="text-red">
                <strong>{status === 'delayed' ? 'Delayed' : 'Not completed'}:</strong> {a.label}
              </li>
            ))}
            {criticalDone.map(({ action: a }) => (
              <li key={a.id} className="text-green">
                Completed: {a.label}
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="keep-badge-bg inline-block rounded-lg bg-green-soft px-3 py-1.5 text-sm text-green ring-1 ring-green/40"
          >
            All {criticalDone.length} critical actions completed. ✓
          </p>
        )}
      </section>
      )}

      {/* Faculty notes */}
      {(snapshot.notes.length > 0 || amend) && (
        <section className={snapshot.notes.length === 0 ? 'no-print' : undefined}>
          <h2 className="mb-2 text-lg font-bold">Faculty notes</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {snapshot.notes.map((n, i) =>
              noteDraft !== null && noteDraft.idx === i ? (
                <li key={i} className="no-print">
                  <div className="flex max-w-md gap-2">
                    <input
                      className="input"
                      value={noteDraft.text}
                      onChange={(e) => setNoteDraft({ idx: i, text: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && saveNoteDraft()}
                      autoFocus
                      aria-label="Edit note text"
                    />
                    <button className="btn-secondary shrink-0" onClick={saveNoteDraft}>
                      Save
                    </button>
                    <button
                      className="shrink-0 text-xs text-faint hover:text-ink-2"
                      onClick={() => setNoteDraft(null)}
                    >
                      cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li key={i}>
                  <span className="font-mono text-faint">{fmt(n.t)}</span> — {n.text}
                  {n.postHoc && (
                    <span className="keep-badge-bg ml-2 rounded-ctl bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted ring-1 ring-line">
                      added at debrief
                    </span>
                  )}
                  {amend && (
                    <span className="no-print ml-2 space-x-2 text-xs">
                      <button
                        className="text-brand-strong hover:underline"
                        onClick={() => {
                          setConfirmDeleteIdx(null);
                          setNoteDraft({ idx: i, text: n.text });
                        }}
                      >
                        edit
                      </button>
                      <button
                        className="text-red hover:text-red"
                        onClick={() => {
                          if (confirmDeleteIdx === i) {
                            setConfirmDeleteIdx(null);
                            // noteDraft.idx is positional — shift it past the
                            // removal or an open editor lands on (and Save
                            // silently overwrites) the wrong note.
                            if (noteDraft !== null && typeof noteDraft.idx === 'number') {
                              if (noteDraft.idx === i) setNoteDraft(null);
                              else if (noteDraft.idx > i)
                                setNoteDraft({ idx: noteDraft.idx - 1, text: noteDraft.text });
                            }
                            amend.setNotes(snapshot.notes.filter((_, j) => j !== i));
                          } else {
                            setConfirmDeleteIdx(i);
                          }
                        }}
                      >
                        {confirmDeleteIdx === i ? 'confirm delete?' : 'delete'}
                      </button>
                    </span>
                  )}
                </li>
              ),
            )}
            {snapshot.notes.length === 0 && <li className="text-faint">none yet</li>}
          </ul>
          {amend &&
            (noteDraft !== null && noteDraft.idx === 'new' ? (
              <div className="no-print mt-2 flex max-w-md gap-2">
                <input
                  className="input"
                  placeholder="Add a debrief note"
                  value={noteDraft.text}
                  onChange={(e) => setNoteDraft({ idx: 'new', text: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && saveNoteDraft()}
                  autoFocus
                />
                <button className="btn-secondary shrink-0" onClick={saveNoteDraft}>
                  Save
                </button>
                <button
                  className="shrink-0 text-xs text-faint hover:text-ink-2"
                  onClick={() => setNoteDraft(null)}
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                className="no-print mt-2 text-xs text-brand-strong hover:underline"
                onClick={() => setNoteDraft({ idx: 'new', text: '' })}
              >
                + Add note
              </button>
            ))}
        </section>
      )}

      {/* Debrief guide */}
      <section>
        <h2 className="mb-2 text-lg font-bold">Debrief guide</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="label">Key discussion points</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {scenario.debrief.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="label">Suggested questions</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {scenario.debrief.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Reference: expected progression, correct management & common errors */}
      <section>
        <h2 className="mb-2 text-lg font-bold">Reference</h2>
        {scenario.expectedProgression.length > 0 && (
          <div className="mb-4">
            <h3 className="label">Expected progression</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {scenario.expectedProgression.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="label">Correct management</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {scenario.correctManagement.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="label">Common errors</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {scenario.commonErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </article>
  );
}
