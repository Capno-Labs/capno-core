'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ScenarioEditor } from '@/components/editor/ScenarioEditor';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHead } from '@/components/ui/PageHead';
import { PageSkeleton } from '@/components/ui/Skeleton';
import type { Scenario } from '@/lib/engine/types';
import { getScenario, listAllScenarios } from '@/lib/scenarios';
import { getDraft, newDraftKey } from '@/lib/scenarios/draftStore';
import { templateFrom } from '@/lib/scenarios/scenarioId';

/** What the editor opens: a document, or the reason there is none. */
type Opened =
  | {
      kind: 'doc';
      /** Remount key — a different document gets a fresh editor (and history). */
      key: string;
      initial?: Scenario;
      draftKey: string;
      savedId: string | null;
      restored?: { savedAtIso: string; baseline?: Scenario };
    }
  | { kind: 'missing'; id: string };

/**
 * `/editor` — a blank new case; `?id=` — edit a saved or built-in case;
 * `?from=` — a new case that starts as a copy of another. Whichever it is,
 * unsaved edits left behind last time (draftStore.ts) are picked up again.
 */
function open(id: string | null, from: string | null): Opened {
  let base: Scenario | undefined;
  if (id) {
    base = getScenario(id);
    if (!base) return { kind: 'missing', id };
  } else if (from) {
    const source = getScenario(from);
    if (!source) return { kind: 'missing', id: from };
    base = templateFrom(source, new Set(listAllScenarios().map((s) => s.title)));
  }
  const draftKey = id ?? newDraftKey(from);
  const draft = getDraft(draftKey);
  // A draft identical to what it started from is not worth announcing.
  const changed = draft && JSON.stringify(draft.scenario) !== JSON.stringify(base ?? null);
  return {
    kind: 'doc',
    key: id ? `id:${id}` : `new:${from ?? ''}`,
    initial: changed ? draft.scenario : base,
    draftKey,
    savedId: id,
    restored: changed ? { savedAtIso: draft.savedAtIso, baseline: base } : undefined,
  };
}

function EditorContent() {
  const search = useSearchParams();
  const id = search.get('id');
  const from = search.get('from');
  const [opened, setOpened] = useState<Opened | undefined>(undefined);
  /** An id the open editor just saved itself under: the address changes to
   *  match, but the editor (and its undo history) must not be remounted. */
  const adopted = useRef<string | null>(null);

  useEffect(() => {
    if (id && id === adopted.current) return;
    adopted.current = null;
    setOpened(open(id, from));
  }, [id, from]);

  if (opened === undefined) return <PageSkeleton kind="form" />;

  if (opened.kind === 'missing') {
    return (
      <EmptyState
        icon="alert"
        title="That case is not on this device"
        body={`No case with the ID “${opened.id}” was found. It may have been deleted, or saved on another device and not synced here yet.`}
        action={
          <Button variant="primary" href="/scenarios" icon="library">
            Back to the library
          </Button>
        }
        secondaryAction={
          <Button variant="ghost" href="/editor" icon="plus">
            New case
          </Button>
        }
      />
    );
  }

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
      <ScenarioEditor
        key={opened.key}
        initial={opened.initial}
        draftKey={opened.draftKey}
        savedId={opened.savedId}
        restored={opened.restored}
        onSavedAs={(savedId) => {
          adopted.current = savedId;
          window.history.replaceState(null, '', `/editor?id=${savedId}${window.location.hash}`);
        }}
      />
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
