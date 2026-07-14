'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ScenarioEditor } from '@/components/editor/ScenarioEditor';
import type { Scenario } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';

function EditorContent() {
  const search = useSearchParams();
  const id = search.get('id');
  const [initial, setInitial] = useState<Scenario | null | undefined>(undefined);

  useEffect(() => {
    setInitial(id ? (getScenario(id) ?? null) : null);
  }, [id]);

  if (initial === undefined) return null;

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <header>
        <Link href="/scenarios" className="text-xs text-slate-500 hover:text-slate-300">
          ← library
        </Link>
        <h1 className="text-2xl font-bold">Case editor</h1>
        <p className="mt-1 text-sm text-slate-400">
          Saved scenarios are stored on this device and appear in the library, where you can
          organize them into collections that match your syllabus — and they sync to your
          institution&apos;s cloud library when you are signed in as faculty. Editing a built-in
          scenario saves a custom copy that shadows it. Export/import JSON files to share manually.
        </p>
      </header>
      <ScenarioEditor initial={initial ?? undefined} key={id ?? 'new'} />
    </main>
  );
}

export default function EditorPage() {
  return (
    <FacultyGate>
      <Suspense>
        <EditorContent />
      </Suspense>
    </FacultyGate>
  );
}
