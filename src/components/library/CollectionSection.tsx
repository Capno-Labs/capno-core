'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { confirmDialog } from '@/lib/store/dialogStore';
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
  onSwap,
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
  /** Swap two visible neighbors — always changes on-screen order even with unresolved refs between them in storage. */
  onSwap: (idA: string, idB: string) => void;
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
          <h2 className="label !mb-0 flex items-center gap-2">
            <Icon name="folder" size={14} />
            {collection.title}{' '}
            <span className="font-normal normal-case text-faint">
              ({items.length + missingIds.length})
            </span>
          </h2>
        )}
        {showControls && !editing && (
          <Menu label={`Actions for collection ${collection.title}`} triggerClassName="btn-ghost btn-sm">
            <MenuItem icon="edit" onSelect={() => setEditing(true)}>
              Rename
            </MenuItem>
            <MenuItem icon="download" onSelect={onExport}>
              Export bundle (JSON)
            </MenuItem>
            <MenuItem
              icon="trash"
              tone="danger"
              onSelect={() => {
                void confirmDialog({
                  title: 'Delete this collection?',
                  body: `“${collection.title}” will be removed. Its cases stay in the library.`,
                  confirmLabel: 'Delete collection',
                  tone: 'danger',
                }).then((ok) => {
                  if (ok) onDelete();
                });
              }}
            >
              Delete collection
            </MenuItem>
          </Menu>
        )}
      </div>
      {collection.description && <p className="text-sm text-faint">{collection.description}</p>}
      {items.length === 0 && missingIds.length === 0 && (
        <p className="text-sm text-faint">
          Empty — use the ⋯ menu on any case to add it here.
        </p>
      )}
      <ul className="space-y-3">
        {items.map((s, i) => (
          <li key={s.id} className="flex items-stretch gap-2">
            {showControls && (
              <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                <button
                  className="btn-ghost btn-sm btn-icon !h-7 !w-7"
                  onClick={() => onSwap(s.id, items[i - 1].id)}
                  disabled={i === 0}
                  title="Move up"
                  aria-label={`Move ${s.title} up`}
                >
                  <Icon name="chevron-down" size={14} className="rotate-180" />
                </button>
                <button
                  className="btn-ghost btn-sm btn-icon !h-7 !w-7"
                  onClick={() => onSwap(s.id, items[i + 1].id)}
                  disabled={i === items.length - 1}
                  title="Move down"
                  aria-label={`Move ${s.title} down`}
                >
                  <Icon name="chevron-down" size={14} />
                </button>
                <button
                  className="btn-ghost btn-sm btn-icon !h-7 !w-7"
                  onClick={() => onRemove(s.id)}
                  title="Remove from collection (scenario is kept)"
                  aria-label={`Remove ${s.title} from collection`}
                >
                  <Icon name="close" size={14} />
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
              className="flex items-center justify-between gap-2 rounded-ctl border border-dashed border-line px-3 py-2 text-xs text-faint"
            >
              <span>
                <code>{id}</code> — not on this device: it was deleted here or belongs to a
                bundle not yet imported. Import a bundle containing it, or remove the reference.
              </span>
              <button
                className="btn-ghost btn-sm btn-icon !h-7 !w-7"
                onClick={() => onRemove(id)}
                aria-label={`Remove missing reference ${id}`}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
