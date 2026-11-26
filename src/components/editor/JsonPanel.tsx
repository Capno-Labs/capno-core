'use client';

/**
 * The editor's advanced surface: the full scenario document as raw JSON.
 *
 * Opt-in via "Edit JSON" (Review & publish, Advanced) — it replaces the form surface
 * entirely, so the two can never fight over the document. The text is
 * (re)generated from the scenario when the panel opens; it becomes the source
 * of truth only after "Apply JSON" (validated with the same zod schema used
 * at runtime). While there are unapplied edits, the shell blocks Save, Test
 * run, and section switching.
 */
export function JsonPanel({
  text,
  dirty,
  onChange,
  onApply,
  onDiscard,
  onClose,
}: {
  text: string;
  dirty: boolean;
  onChange: (text: string) => void;
  onApply: () => void;
  onDiscard: () => void;
  /** Back to the form; only offered when nothing is unapplied. */
  onClose: () => void;
}) {
  return (
    <section className="card flex flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          The case as JSON
        </h2>
        {dirty ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-warn-strong">unapplied edits</span>
            <button className="btn-primary btn-sm" onClick={onApply}>
              Apply JSON
            </button>
            <button className="btn-ghost btn-sm" onClick={onDiscard}>
              Discard
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-faint">Edits apply only after “Apply JSON”.</span>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
              Back to the form
            </button>
          </div>
        )}
      </div>
      <textarea
        className="input min-h-[600px] flex-1 font-mono text-xs leading-relaxed"
        spellCheck={false}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Scenario JSON"
      />
    </section>
  );
}
