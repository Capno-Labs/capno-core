'use client';

/**
 * The editor's advanced surface: the full scenario document as raw JSON.
 *
 * Opt-in via the toolbar's "Edit JSON" toggle — it replaces the form surface
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
}: {
  text: string;
  dirty: boolean;
  onChange: (text: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="card flex flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Full definition (JSON) — advanced
        </h2>
        {dirty ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-strong">unapplied edits</span>
            <button className="btn-primary !py-1 text-xs" onClick={onApply}>
              Apply JSON
            </button>
            <button className="btn-ghost !py-1 text-xs" onClick={onDiscard}>
              Discard
            </button>
          </div>
        ) : (
          <span className="text-xs text-faint">
            the full document — edits apply only after “Apply JSON”
          </span>
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
