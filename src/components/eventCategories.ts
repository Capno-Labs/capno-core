import type { EventCategory } from '@/lib/engine/types';

/**
 * Shared color language for event categories, used by both the faculty run
 * screen (FlowPanel) and the scenario editor so authoring and running look
 * the same. Full literal class strings so Tailwind's scanner picks them up.
 * Category hues are fixed mid-weight values (arbitrary hex where the semantic
 * theme palette shadows the Tailwind scale) with low-alpha hover tints so the
 * chips read correctly in both the dark and light app themes.
 */

export const CATEGORY_STYLES: Record<EventCategory, string> = {
  physiology: 'ring-[#ef4444]/50 hover:bg-[#ef4444]/10',
  airway: 'ring-sky-500/50 hover:bg-sky-500/10',
  circulation: 'ring-rose-500/50 hover:bg-rose-500/10',
  drug: 'ring-emerald-500/50 hover:bg-emerald-500/10',
  equipment: 'ring-[#f59e0b]/60 hover:bg-[#f59e0b]/10',
  surgical: 'ring-orange-500/50 hover:bg-orange-500/10',
  resolution: 'ring-teal-500/50 hover:bg-teal-500/10',
  other: 'ring-line-2 hover:bg-panel-2',
};

/** Compact dot swatch per category, for tight editor rows and chips. */
export const CATEGORY_DOT: Record<EventCategory, string> = {
  physiology: 'bg-[#ef4444]',
  airway: 'bg-sky-500',
  circulation: 'bg-rose-500',
  drug: 'bg-emerald-500',
  equipment: 'bg-[#f59e0b]',
  surgical: 'bg-orange-500',
  resolution: 'bg-teal-500',
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
