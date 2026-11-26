'use client';

import { Callout } from '@/components/ui/Callout';
import { Disclosure } from '@/components/ui/Disclosure';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { NumberField } from '@/components/ui/NumberField';
import { Pill, type PillTone } from '@/components/ui/Pill';
import type { CloudScenarioStatus } from '@/lib/cloud/outbox';
import type { Scenario } from '@/lib/engine/types';
import type { ScenarioVersion } from '@/lib/scenarios/customStore';
import { ReadinessList } from '../ReadinessList';
import type { ReadinessItem } from '../readiness';
import { RubricEditor } from '../RubricEditor';
import { SectionCard, SectionHead } from './SectionHead';

const STATUS: Record<CloudScenarioStatus, { tone: PillTone; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  review: { tone: 'warn', label: 'In review' },
  published: { tone: 'green', label: 'Published' },
};

/** Publishing to the institution library; absent when no faculty account is signed in. */
export interface PublishControls {
  status: CloudScenarioStatus | null;
  busy: boolean;
  /** Why the button is off, or null when it can be pressed. */
  blocked: string | null;
  onApprove: () => void;
}

/**
 * The last step: what still needs attention, the saved versions, and the
 * parts most cases never open — scoring, and the case as a file.
 */
export function ReviewSection({
  scenario,
  update,
  saved,
  unsaved,
  items,
  onShow,
  versions,
  onRestore,
  publish,
  onTestRun,
  freshRubric,
  onEditJson,
  onExport,
  onImport,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
  /** The case has been saved at least once, so its ID is in use. */
  saved: boolean;
  /** There are edits since the last saved version. */
  unsaved: boolean;
  items: ReadinessItem[];
  onShow: (item: ReadinessItem) => void;
  versions: ScenarioVersion[];
  onRestore: (version: ScenarioVersion) => void;
  publish: PublishControls | null;
  onTestRun: () => void;
  freshRubric: Set<string>;
  onEditJson: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const fixes = items.filter((item) => item.level === 'fix').length;
  const looks = items.length - fixes;
  const actions = scenario.expectedActions;
  const points = actions.reduce((sum, a) => sum + a.points, 0);

  const setPoints = (index: number, value: number) =>
    update({ expectedActions: actions.map((a, i) => (i === index ? { ...a, points: value } : a)) });

  return (
    <div className="space-y-4">
      <SectionHead title="Review & publish">
        What still needs attention before this case is used in a session.
      </SectionHead>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-ink">Readiness</h3>
          {fixes > 0 ? (
            <Pill tone="red">{fixes} to fix</Pill>
          ) : (
            <Pill tone="green">
              <Icon name="check" size={10} /> Ready to run
            </Pill>
          )}
          {looks > 0 && <Pill tone="warn">{looks} worth a look</Pill>}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing to fix, and nothing flagged.</p>
        ) : (
          <>
            <p className="text-xs text-faint">
              {fixes > 0
                ? 'A case cannot be saved or run until everything marked “Must fix” is sorted. '
                : ''}
              {looks > 0 ? '“Worth a look” items are often intended and never stop you saving.' : ''}
            </p>
            <ReadinessList items={items} onShow={onShow} showSection />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="btn-secondary" disabled={fixes > 0} onClick={onTestRun}>
            <Icon name="play" size={16} /> Test run
          </button>
          {publish && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={publish.busy || publish.blocked !== null}
                onClick={publish.onApprove}
              >
                {publish.busy ? 'Approving…' : 'Approve & publish'}
              </button>
              {publish.status && (
                <Pill tone={STATUS[publish.status].tone} title="State of this case in your institution’s library">
                  {STATUS[publish.status].label}
                </Pill>
              )}
              {publish.blocked && <span className="text-xs text-faint">{publish.blocked}</span>}
            </>
          )}
        </div>
        {publish && (
          <p className="text-xs text-faint">
            Sessions run against the approved version. Saving a new edit over a published case
            returns it to draft until it is approved again.
          </p>
        )}
      </section>

      <SectionCard
        title={`Saved versions${versions.length > 0 ? ` (${versions.length})` : ''}`}
        hint="Each “Save version” is kept here on this device. Restoring one replaces what is in the editor, and can be undone."
      >
        {unsaved && (
          <Callout tone="info">
            You have changes that are not in a saved version yet. They are kept as a draft on this
            device until you save.
          </Callout>
        )}
        {versions.length === 0 ? (
          <p className="text-sm text-faint">No saved versions yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {versions.map((v, i) => (
              <li
                key={v.savedAtIso}
                className="flex flex-wrap items-center justify-between gap-2 rounded-ctl bg-panel-2 px-3 py-1.5"
              >
                <span className="tabular-nums">
                  {new Date(v.savedAtIso).toLocaleString()}{' '}
                  <span className="text-xs text-faint">
                    v{v.scenario.version}
                    {i === 0 ? ' · latest' : ''}
                  </span>
                </span>
                {i > 0 && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onRestore(v)}>
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <section className="card space-y-3">
        <Disclosure
          title="Scoring"
          summary={`Optional · ${points} point${points === 1 ? '' : 's'} · ${scenario.rubric.length} categor${scenario.rubric.length === 1 ? 'y' : 'ies'}`}
        >
          <p className="text-xs text-faint">
            Only matters if you report scores. Nothing is scored unless you enter points: a new
            action starts at 0. A done action earns its points, a delayed one half, a missed or
            incorrect one none.
          </p>
          <div>
            <h4 className="label">Points for each action</h4>
            <ul className="divide-y divide-line">
              {actions.map((a, i) => (
                <li key={a.id || i} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 text-sm text-ink-2">
                    {a.label || 'Untitled action'} {a.critical && <Pill tone="red">Critical</Pill>}
                  </span>
                  <NumberField
                    className="w-24 shrink-0"
                    label={<span className="sr-only">Points for {a.label || `action ${i + 1}`}</span>}
                    unit="pts"
                    value={a.points}
                    min={0}
                    max={1000}
                    integer
                    required
                    onChange={(n) => n !== undefined && setPoints(i, n)}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="label">Categories</h4>
            <p className="mb-2 text-xs text-faint">
              Group actions into categories only if you report scores by category.
            </p>
            <RubricEditor
              rubric={scenario.rubric}
              actions={actions}
              fresh={freshRubric}
              onChange={(rubric) => update({ rubric })}
            />
          </div>
        </Disclosure>

        <Disclosure title="Advanced" summary="Case ID, version label, the case as a file">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Case ID"
              hint={
                saved
                  ? 'Lowercase letters, numbers and dashes. Changing it saves this case as a separate one; the original keeps its history.'
                  : 'Created from the title when you first save. Lowercase letters, numbers and dashes.'
              }
            >
              <input className="input font-mono" value={scenario.id} onChange={(e) => update({ id: e.target.value })} />
            </Field>
            <Field label="Version label" hint="Your own numbering, for example 1.2.0.">
              <input
                className="input font-mono"
                value={scenario.version}
                onChange={(e) => update({ version: e.target.value })}
              />
            </Field>
          </div>
          <div>
            <h4 className="label">The case as a file</h4>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={onExport}>
                <Icon name="download" size={14} /> Export JSON
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={onImport}>
                <Icon name="upload" size={14} /> Import JSON
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={onEditJson}>
                <Icon name="code" size={14} /> Edit JSON
              </button>
            </div>
            <p className="mt-1 text-xs text-faint">
              Export to move a case between devices or keep a backup. Importing a file, or editing
              the JSON, replaces what is in the editor; both can be undone.
            </p>
          </div>
        </Disclosure>
      </section>
    </div>
  );
}
