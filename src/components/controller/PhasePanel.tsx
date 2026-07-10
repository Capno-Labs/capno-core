'use client';

import { useControllerStore } from '@/lib/store/controllerStore';

/** Phase-of-care stepper (preinduction → induction → … ). */
export function PhasePanel() {
  const { engine, snapshot, setPhase } = useControllerStore();
  if (!engine || !snapshot) return null;

  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Phase</h2>
      <div className="flex flex-wrap gap-1.5">
        {engine.scenario.phases.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setPhase(p.id)}
            title={p.description}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              snapshot.phaseId === p.id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {i + 1}. {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
