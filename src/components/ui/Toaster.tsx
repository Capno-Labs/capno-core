'use client';

import { useToastStore, type Toast } from '@/lib/store/toastStore';

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'ring-emerald-700 text-emerald-300',
  error: 'ring-red-700 text-red-300',
  info: 'ring-slate-600 text-slate-200',
};

/** Fixed bottom-center toast stack. Mounted once in the root layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-md bg-slate-800 px-3 py-2 text-sm shadow-lg ring-1 ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
