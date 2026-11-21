import type { EventCategory } from '@/lib/engine/types';

/**
 * Shared color language for event categories, used by both the faculty run
 * screen (FlowPanel) and the scenario editor so authoring and running look
 * the same. Full literal class strings so Tailwind's scanner picks them up.
 * Category hues are the fixed `cat.*` colours in tailwind.config.ts, with
 * low-alpha hover tints so the chips read correctly in both app themes.
 */

export const CATEGORY_STYLES: Record<EventCategory, string> = {
  physiology: 'ring-cat-physiology/50 hover:bg-cat-physiology/10',
  airway: 'ring-cat-airway/50 hover:bg-cat-airway/10',
  circulation: 'ring-cat-circulation/50 hover:bg-cat-circulation/10',
  drug: 'ring-cat-drug/50 hover:bg-cat-drug/10',
  equipment: 'ring-cat-equipment/60 hover:bg-cat-equipment/10',
  surgical: 'ring-cat-surgical/50 hover:bg-cat-surgical/10',
  resolution: 'ring-cat-resolution/50 hover:bg-cat-resolution/10',
  other: 'ring-line-2 hover:bg-panel-2',
};

/** Compact dot swatch per category, for tight editor rows and chips. */
export const CATEGORY_DOT: Record<EventCategory, string> = {
  physiology: 'bg-cat-physiology',
  airway: 'bg-cat-airway',
  circulation: 'bg-cat-circulation',
  drug: 'bg-cat-drug',
  equipment: 'bg-cat-equipment',
  surgical: 'bg-cat-surgical',
  resolution: 'bg-cat-resolution',
  other: 'bg-faint',
};

export const CATEGORIES: EventCategory[] = [
  'physiology',
  'airway',
  'circulation',
  'drug',
  'equipment',
  'surgical',
  'resolution',
  'other',
];
