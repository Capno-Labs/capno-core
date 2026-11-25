import type { ReactNode } from 'react';

/** Title and one-line purpose at the top of an editor section. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
      {children && <p className="mt-1 max-w-2xl text-sm text-muted">{children}</p>}
    </header>
  );
}

/** A titled card inside a section. */
export function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
