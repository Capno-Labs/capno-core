'use client';

import { PageSkeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { cloudEligible, drain, enqueue, getPushedAt } from '@/lib/cloud/outbox';
import {
  deleteImport,
  finalizeDraft,
  getImport,
  markJobFinalized,
  saveDraft,
  saveImport,
  syncDraftToService,
  type ImportDraft,
  type StoredImport,
} from '@/lib/import';
import { BUILT_IN_SCENARIOS, QUICK_START_ID, listCustomScenarios, saveCustomScenario } from '@/lib/scenarios';
import { cloudTakenScenarioIds } from '@/lib/cloud/scenarioCloud';
import { freeScenarioId } from '@/lib/scenarios/scenarioId';
import { toast } from '@/lib/store/toastStore';
import { DraftFields } from './DraftFields';
import { labelForPath, rowIdForEntry } from './fieldRegistry';
import { SourcePane } from './SourcePane';

/**
 * Side-by-side review of an imported run sheet: source blocks on the left,
 * the typed draft on the right, and a queue of everything that still needs
 * a faculty decision. "Save to library" is enabled only when that queue is
 * empty — nothing is filled in on the reviewer's behalf.
 */
export function ImportReview({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [stored, setStored] = useState<StoredImport | null | undefined>(undefined);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const item = getImport(sourceId) ?? null;
    setStored(item);
    setDraftId(item?.drafts[0]?.draftId ?? null);
  }, [sourceId]);

  const draft = stored?.drafts.find((d) => d.draftId === draftId) ?? null;
  const unresolved = useMemo(() => {
    if (!draft) return [];
    const r = finalizeDraft(draft);
    return r.ok ? [] : r.unresolved;
  }, [draft]);
  const unmapped = useMemo(() => new Set(draft?.unmappedBlockIds ?? []), [draft]);

  if (stored === undefined) return <PageSkeleton kind="form" />;
  if (!stored || !draft) {
    return (
      <section className="card space-y-2">
        <p className="text-sm text-muted">This import is no longer stored on this device.</p>
        <button className="btn-secondary" onClick={() => router.push('/scenarios/import')}>
          Start a new import
        </button>
      </section>
    );
  }

  const updateDraft = (next: ImportDraft) => {
    const updated = { ...next, updatedAtIso: new Date().toISOString() };
    const saved = saveDraft(updated);
    if (!saved.ok) {
      toast(saved.error, 'error');
      return;
    }
    setStored(getImport(sourceId) ?? null);
    void syncDraftToService(updated);
  };

  const finish = async () => {
    if (saving) return;
    const result = finalizeDraft(draft);
    if (!result.ok) {
      toast(`Still unresolved: ${labelForPath(result.unresolved[0], draft.fields)}`, 'error');
      return;
    }
    const taken = new Set([
      ...BUILT_IN_SCENARIOS.map((s) => s.id),
      QUICK_START_ID,
      ...listCustomScenarios().map((s) => s.id),
    ]);
    // Case ids are unique across every organization in the cloud, so an id
    // that is free here can still belong to another program. Ask first; if
    // the cloud cannot answer, the id that is free on this device is used.
    setSaving(true);
    const { id } = await freeScenarioId(result.scenario.id, taken, cloudTakenScenarioIds);
    setSaving(false);
    const scenario = { ...result.scenario, id };
    const saved = saveCustomScenario(scenario);
    if (!saved.ok) {
      toast(saved.error, 'error');
      return;
    }
    const { jobId } = draft;
    if (cloudEligible()) {
      enqueue('scenario', id);
      void drain().then((r) => {
        // A refused push (the ID belongs to another program, say) must not
        // pass silently: the case is then on this device only.
        for (const message of r.dropped) toast(message, 'error');
        // The service links a job only to a scenario already in the cloud,
        // so this waits for the push instead of racing it.
        if (jobId && getPushedAt('scenario', id)) void markJobFinalized(jobId, id);
      });
    } else if (jobId) {
      void markJobFinalized(jobId, scenario.id);
    }
    // The finished draft leaves the review; the source stays until its
    // last draft is done.
    const remaining = stored.drafts.filter((d) => d.draftId !== draft.draftId);
    if (remaining.length === 0) deleteImport(sourceId);
    else saveImport({ sourceId, source: stored.source, drafts: remaining });
    toast(`Saved “${scenario.title}” to the library — review it in the editor, then approve`, 'success');
    router.push(`/editor?id=${encodeURIComponent(scenario.id)}`);
  };

  const confirmedCount = countByStatus(draft, 'confirmed');
  const extractedCount = countByStatus(draft, 'extracted');

  return (
    <div className="space-y-4">
      {stored.drafts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-faint">Scenarios in this run sheet:</span>
          {stored.drafts.map((d) => (
            <button
              key={d.draftId}
              className={d.draftId === draftId ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
              onClick={() => setDraftId(d.draftId)}
            >
              {d.fields.title.value ?? d.draftId}
            </button>
          ))}
        </div>
      )}

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Review queue</h2>
          <Pill tone={unresolved.length === 0 ? 'green' : 'warn'}>
            {unresolved.length === 0 ? 'ready to save' : `${unresolved.length} to resolve`}
          </Pill>
          <span className="text-xs text-faint">
            {extractedCount} from source · {confirmedCount} confirmed · parser profile {draft.profile}
          </span>
          <button className="btn-primary ml-auto" onClick={() => void finish()} disabled={unresolved.length > 0 || saving}>
            {saving ? 'Saving…' : 'Save to library'}
          </button>
        </div>
        {unresolved.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {unresolved.slice(0, 40).map((path) => (
              <li key={path}>
                <button
                  className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line hover:bg-panel-3"
                  onClick={() =>
                    document.getElementById(rowIdForEntry(path))?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  }
                >
                  {labelForPath(path, draft.fields)}
                </button>
              </li>
            ))}
            {unresolved.length > 40 && <li className="text-xs text-faint">+{unresolved.length - 40} more</li>}
          </ul>
        )}
        <p className="text-xs text-warn-strong">
          Nothing is filled in for you. Values the run sheet does not state — vital signs, doses, patient
          details, timings — stay “not in source” until you enter them.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card max-h-[80vh] overflow-y-auto lg:sticky lg:top-[calc(var(--topbar-h)+1rem)] lg:max-h-[calc(100vh-var(--topbar-h)-2rem)]">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Source · {stored.source.title ?? 'pasted text'}
          </h3>
          <SourcePane doc={stored.source} activeBlockId={activeBlockId} unmappedBlockIds={unmapped} />
          {unmapped.size > 0 && (
            <p className="mt-2 text-[10px] text-faint">Dashed blocks were not placed in the draft.</p>
          )}
        </div>
        <DraftFields
          fields={draft.fields}
          onChange={(fields) => updateDraft({ ...draft, fields })}
          onFocusBlock={setActiveBlockId}
        />
      </div>
    </div>
  );
}

function countByStatus(draft: ImportDraft, status: string): number {
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      if ('status' in v && 'provenance' in v) {
        if ((v as { status: string }).status === status) n += 1;
        return;
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(draft.fields);
  return n;
}
