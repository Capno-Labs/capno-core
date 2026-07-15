'use client';

import { useMemo, useState } from 'react';
import { CapnoGlyph } from '@/components/brand/CapnoGlyph';
import { deriveTurningPoints, type TurningPoint } from '@/lib/debrief/turningPoints';
import type { ActionStatus, ArchivedSession, FacultyNote, LogEntry } from '@/lib/engine/types';
import { useCountUp } from '@/lib/hooks/useCountUp';
import { TrendStrip } from './TrendStrip';

/** Performance-tier color for the score reveal (screen only; print is black). */
function tierClasses(percent: number): { text: string; band: string } {
  if (percent >= 90) return { text: 'text-emerald-300', band: 'bg-emerald-400' };
  if (percent >= 75) return { text: 'text-sky-300', band: 'bg-sky-400' };
  if (percent >= 60) return { text: 'text-amber-300', band: 'bg-amber-400' };
  return { text: 'text-red-300', band: 'bg-red-400' };
}

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

const SEVERITY_CLASS: Record<TurningPoint['severity'], string> = {
  info: 'text-slate-300',
  warning: 'text-amber-300',
  critical: 'text-red-300',
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
 * Printable debrief report. On screen it uses the app theme; the
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
  const { scenario, snapshot, score } = session;
  const actionById = new Map(scenario.expectedActions.map((a) => [a.id, a]));
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
  const shownPercent = useCountUp(score.percent);
  const tier = tierClasses(score.percent);
  const turningPoints = useMemo(() => deriveTurningPoints(session), [session]);

  const statusGroups = {
    done: snapshot.actions.filter((a) => a.status === 'done'),
    delayed: snapshot.actions.filter((a) => a.status === 'delayed'),
    incorrect: snapshot.actions.filter((a) => a.status === 'incorrect'),
    missed: snapshot.actions.filter((a) => a.status === 'missed' || a.status === 'pending'),
  };

  return (
    <article className="print-report card space-y-8 !p-6 md:!p-8">
      {/* Header */}
      <header className="border-b border-slate-700 pb-4">
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
          <CapnoGlyph className="h-4 w-auto shrink-0" />
          CAPNO Studio debrief report · simulation only — not a clinical record
        </p>
        <h1 className="mt-1 text-2xl font-bold">{scenario.title}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Session {session.sessionId} · {new Date(session.endedAtIso).toLocaleString()} · duration{' '}
          {fmt(snapshot.elapsedSec)} · {scenario.patient.name}, {scenario.patient.age}
          {scenario.patient.sex === 'male' ? 'M' : 'F'}, ASA {scenario.patient.asa}
        </p>
        <p className="mt-1 text-sm text-slate-300">
          <span className="font-semibold">Learners:</span>{' '}
          {session.learnerNames?.length ? session.learnerNames.join(', ') : '—'}
          {amend && learnersDraft === null && (
            <button
              className="no-print ml-2 text-xs text-sky-400 hover:text-sky-300"
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

      {/* Outcome summary */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Outcome summary</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center motion-safe:animate-pop-in">
            <div className={`text-5xl font-bold tabular-nums ${tier.text}`}>
              {/* Count-up is screen-only; print always gets the true value. */}
              <span className="print:hidden">{shownPercent}%</span>
              <span className="hidden print:inline">{score.percent}%</span>
            </div>
            <div
              className={`keep-badge-bg mx-auto mt-1 h-1 rounded ${tier.band}`}
              style={{ width: `${Math.max(8, score.percent)}%` }}
            />
            <div className="mt-1 text-xs text-slate-500">
              {score.earned} / {score.possible} pts
            </div>
          </div>
          <table className="text-sm">
            <tbody>
              {score.categories.map((c, i) => (
                <tr key={c.categoryId}>
                  <td className="pr-6 py-0.5">{c.label}</td>
                  <td className="py-0.5 font-mono tabular-nums">
                    {c.earned}/{c.possible}
                  </td>
                  <td className="pl-3 py-0.5 w-40">
                    <div className="keep-badge-bg h-2 w-full rounded bg-slate-700">
                      <div
                        className="anim-bar h-2 origin-left rounded bg-emerald-500 motion-safe:animate-bar-grow"
                        style={{
                          width: `${c.possible ? (c.earned / c.possible) * 100 : 0}%`,
                          animationDelay: `${150 + i * 90}ms`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* What happened: vitals trends + timeline */}
      <section>
        <h2 className="mb-2 text-lg font-bold">What happened</h2>
        {session.history && session.history.length >= 2 && (
          <div className="mb-4">
            <h3 className="label mb-2">Vitals trends</h3>
            <TrendStrip history={session.history} log={snapshot.log} />
          </div>
        )}
        <h3 className="label mb-1">Timeline</h3>
        <table className="w-full text-sm">
          <tbody>
            {snapshot.log
              .filter((e) => e.kind !== 'vital_change' || snapshot.log.length < 80)
              .map((e, i) => (
                <tr key={i} className="border-b border-slate-800 align-top">
                  <td className="w-14 py-1 font-mono tabular-nums text-slate-500">{fmt(e.t)}</td>
                  <td className="w-20 py-1 text-xs uppercase text-slate-500">{KIND_LABEL[e.kind]}</td>
                  <td className="py-1">
                    {e.label}
                    {e.detail && <span className="text-slate-500"> — {e.detail}</span>}
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
                <span className="w-14 shrink-0 font-mono tabular-nums text-slate-500">
                  {fmt(p.t)}
                </span>
                <span className={SEVERITY_CLASS[p.severity]}>
                  {p.label}
                  {p.detail && <span className="text-slate-500"> — {p.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions taken */}
      <section>
        <h2 className="mb-2 text-lg font-bold">What the learner did</h2>
        {amend && (
          <p className="no-print mb-2 text-xs text-slate-500">
            Live marking is hard mid-scenario — amend any status below; the score updates and is
            saved immediately.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['done', 'Done', 'text-emerald-300'],
              ['delayed', 'Delayed', 'text-amber-300'],
              ['incorrect', 'Incorrect', 'text-red-300'],
              ['missed', 'Missed', 'text-slate-400'],
            ] as const
          ).map(([key, label, cls]) => (
            <div key={key}>
              <h3 className={`text-sm font-bold ${cls}`}>
                {label} ({statusGroups[key].length})
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {statusGroups[key].map((r) => {
                  const a = actionById.get(r.actionId);
                  if (!a) return null;
                  return (
                    <li key={r.actionId}>
                      {a.critical && <strong>[critical] </strong>}
                      {a.label}
                      {r.markedAtSec !== undefined && (
                        <span className="text-slate-500"> @ {fmt(r.markedAtSec)}</span>
                      )}
                      {amend && (
                        <select
                          className="no-print ml-2 rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-300 ring-1 ring-slate-700"
                          value={r.status === 'pending' ? 'missed' : r.status}
                          onChange={(e) => amend.markAction(r.actionId, e.target.value as ActionStatus)}
                          aria-label={`Amend status for ${a.label}`}
                        >
                          {AMENDABLE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
                {statusGroups[key].length === 0 && <li className="text-slate-500">none</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Critical actions, promoted */}
      <section>
        <h2 className="mb-2 text-lg font-bold">Missed or delayed critical actions</h2>
        {score.criticalMissed.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {score.criticalMissed.map((a) => (
              <li key={a.id} className="text-red-300">
                <strong>Not completed:</strong> {a.label}
              </li>
            ))}
            {score.criticalDone.map((a) => (
              <li key={a.id} className="text-emerald-300">
                Completed: {a.label}
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="keep-badge-bg inline-block rounded-lg bg-emerald-950/60 px-3 py-1.5 text-sm text-emerald-300 ring-1 ring-emerald-700 motion-safe:animate-pop-in"
            style={{ animationDelay: '700ms' }}
          >
            All {score.criticalDone.length} critical actions completed. ✓
          </p>
        )}
      </section>

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
                      className="shrink-0 text-xs text-slate-500 hover:text-slate-300"
                      onClick={() => setNoteDraft(null)}
                    >
                      cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li key={i}>
                  <span className="font-mono text-slate-500">{fmt(n.t)}</span> — {n.text}
                  {n.postHoc && (
                    <span className="keep-badge-bg ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-slate-700">
                      added at debrief
                    </span>
                  )}
                  {amend && (
                    <span className="no-print ml-2 space-x-2 text-xs">
                      <button
                        className="text-sky-400 hover:text-sky-300"
                        onClick={() => {
                          setConfirmDeleteIdx(null);
                          setNoteDraft({ idx: i, text: n.text });
                        }}
                      >
                        edit
                      </button>
                      <button
                        className="text-red-400 hover:text-red-300"
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
            {snapshot.notes.length === 0 && <li className="text-slate-500">none yet</li>}
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
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => setNoteDraft(null)}
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                className="no-print mt-2 text-xs text-sky-400 hover:text-sky-300"
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

      {/* Reference: correct management & common errors */}
      <section>
        <h2 className="mb-2 text-lg font-bold">Reference</h2>
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
