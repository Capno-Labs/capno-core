'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ScenarioEditor } from '@/components/editor/ScenarioEditor';
import { PageHead } from '@/components/ui/PageHead';
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
    <div className="space-y-4">
      <PageHead
        eyebrow="Authoring"
        title="Case editor"
        lede="Saved scenarios are stored on this device and appear in the library, where you can organize them into collections that match your syllabus — and they sync to your institution's cloud library when you are signed in as faculty. Editing a built-in scenario saves a custom copy that shadows it. Export/import JSON files to share manually."
      />
      <ScenarioEditor initial={initial ?? undefined} key={id ?? 'new'} />
    </div>
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
