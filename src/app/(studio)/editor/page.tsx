'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ScenarioEditor } from '@/components/editor/ScenarioEditor';
import { PageHead } from '@/components/ui/PageHead';
import { PageSkeleton } from '@/components/ui/Skeleton';
import type { Scenario } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';

function EditorContent() {
  const search = useSearchParams();
  const id = search.get('id');
  const [initial, setInitial] = useState<Scenario | null | undefined>(undefined);

  useEffect(() => {
    setInitial(id ? (getScenario(id) ?? null) : null);
  }, [id]);

  if (initial === undefined) return <PageSkeleton kind="form" />;

  return (
    <div className="space-y-4">
      <PageHead
        eyebrow="Authoring"
        title="Case editor"
        lede={
          <>
            Saved cases are stored on this device and appear in the library.
            <details className="mt-1">
              <summary className="link cursor-pointer text-xs">Where cases go and how to share them</summary>
              <span className="mt-1 block">
                Organize saved cases into collections that match your syllabus. They sync to your
                institution&rsquo;s cloud library when you are signed in as faculty. Editing a
                built-in case saves a custom copy that shadows it. Export/import JSON files to
                share manually.
              </span>
            </details>
          </>
        }
      />
      <ScenarioEditor initial={initial ?? undefined} key={id ?? 'new'} />
    </div>
  );
}

export default function EditorPage() {
  return (
    <FacultyGate>
      <Suspense fallback={<PageSkeleton kind="form" />}>
        <EditorContent />
      </Suspense>
    </FacultyGate>
  );
}
