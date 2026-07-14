'use client';

import { useState, type ReactNode } from 'react';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import type { Scenario } from '@/lib/engine/types';
import type { ScenarioCollection } from '@/lib/scenarios';

/**
 * One collection rendered as a library section: header with rename/export/
 * delete, ordered scenario cards with reorder/remove controls, and muted
 * rows for refs that don't resolve on this device (they stay in the
 * collection — a later import may restore them).
 *
 * Card rendering is injected so the library page's single card closure
 * (Run/Edit/Export/Delete, badges) serves both the domain sections and
 * collection sections.
 */
export function CollectionSection({
  collection,
  items,
  missingIds,
  showControls,
  renderCard,
  onRename,
  onDelete,
  onExport,
  onMove,
  onRemove,
}: {
  collection: ScenarioCollection;
  items: Scenario[];
  missingIds: string[];
  /** False while filters are active — reordering a filtered view would mislead. */
  showControls: boolean;
  renderCard: (s: Scenario) => ReactNode;
  onRename: (title: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onMove: (scenarioId: string, dir: -1 | 1) => void;
  onRemove: (scenarioId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(collection.title);

  const submitRename = () => {
    setEditing(false);
    if (title.trim() && title.trim() !== collection.title) onRename(title.trim());
    else setTitle(collection.title);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              className="input w-56"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Collection title"
              autoFocus
            />
            <button className="btn-secondary" type="submit">
              Save
            </button>
          </form>
        ) : (
          <h2 className="label !mb-0">
            📚 {collection.title}{' '}
            <span className="font-normal normal-case text-slate-600">
              ({items.length + missingIds.length})
            </span>
          </h2>
        )}
        {showControls && !editing && (
          <>
            <button
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={() => setEditing(true)}
              title="Rename collection"
            >
              ✎ rename
            </button>
            <button
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={onExport}
              title="Export the collection and its custom scenarios as one JSON bundle"
            >
              ⬇ export bundle
            </button>
            <ConfirmButton
              label="🗑 delete"
              confirmLabel="Delete collection (scenarios are kept)"
              title="Delete collection — its scenarios are not deleted"
              className="text-xs text-slate-500 hover:text-slate-300"
              onConfirm={onDelete}
            />
          </>
        )}
      </div>
      {collection.description && <p className="text-sm text-slate-500">{collection.description}</p>}
      {items.length === 0 && missingIds.length === 0 && (
        <p className="text-sm text-slate-500">
          Empty — use “＋ Collection…” on any scenario card to add cases.
        </p>
      )}
      <ul className="space-y-3">
        {items.map((s, i) => (
          <li key={s.id} className="flex items-stretch gap-2">
            {showControls && (
              <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                <button
                  className="btn-ghost !px-1.5 !py-0.5 text-xs"
                  onClick={() => onMove(s.id, -1)}
                  disabled={i === 0}
                  title="Move up"
                  aria-label={`Move ${s.title} up`}
                >
                  ↑
                </button>
                <button
                  className="btn-ghost !px-1.5 !py-0.5 text-xs"
                  onClick={() => onMove(s.id, 1)}
                  disabled={i === items.length - 1}
                  title="Move down"
                  aria-label={`Move ${s.title} down`}
                >
                  ↓
                </button>
                <button
                  className="btn-ghost !px-1.5 !py-0.5 text-xs"
                  onClick={() => onRemove(s.id)}
                  title="Remove from collection (scenario is kept)"
                  aria-label={`Remove ${s.title} from collection`}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">{renderCard(s)}</div>
          </li>
        ))}
        {showControls &&
          missingIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 rounded border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500"
            >
              <span>
                <code>{id}</code> — not on this device (import a bundle containing it, or remove
                the reference)
              </span>
              <button
                className="btn-ghost !px-1.5 !py-0.5"
                onClick={() => onRemove(id)}
                aria-label={`Remove missing reference ${id}`}
              >
                ✕
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
