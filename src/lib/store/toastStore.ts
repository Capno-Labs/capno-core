'use client';

import { create } from 'zustand';

/**
 * Lightweight toast notifications (copy/save/import feedback). No deps;
 * mirrors the zustand patterns used by the other stores. Toasts auto-dismiss
 * after a few seconds or on click.
 */

export interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, variant?: Toast['variant']) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 3500;

let nextId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (message, variant = 'info') => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, variant }] });
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Fire a toast from non-component code (event handlers, stores, helpers). */
export function toast(message: string, variant: Toast['variant'] = 'info'): void {
  useToastStore.getState().show(message, variant);
}
