import type { EventCategory } from '@/lib/engine/types';

/**
 * Shared color language for event categories, used by both the faculty run
 * screen (EventPanel) and the scenario editor so authoring and running look
 * the same. Full literal class strings so Tailwind's scanner picks them up.
 */

export const CATEGORY_STYLES: Record<EventCategory, string> = {
  physiology: 'ring-red-500/50 hover:bg-red-950/50',
  airway: 'ring-sky-500/50 hover:bg-sky-950/50',
  circulation: 'ring-rose-500/50 hover:bg-rose-950/50',
  drug: 'ring-emerald-500/50 hover:bg-emerald-950/50',
  equipment: 'ring-amber-500/50 hover:bg-amber-950/50',
  surgical: 'ring-orange-500/50 hover:bg-orange-950/50',
  resolution: 'ring-teal-500/50 hover:bg-teal-950/50',
  other: 'ring-slate-600 hover:bg-slate-800',
};

/** Compact dot swatch per category, for tight editor rows and chips. */
export const CATEGORY_DOT: Record<EventCategory, string> = {
  physiology: 'bg-red-500',
  airway: 'bg-sky-500',
  circulation: 'bg-rose-500',
  drug: 'bg-emerald-500',
  equipment: 'bg-amber-500',
  surgical: 'bg-orange-500',
  resolution: 'bg-teal-500',
  other: 'bg-slate-500',
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
