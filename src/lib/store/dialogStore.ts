'use client';

import { create } from 'zustand';

/**
 * Imperative confirm dialogs — the replacement for `window.confirm`, which
 * blocks the tick loop and can't be styled. `confirmDialog()` resolves true
 * on confirm and false on cancel/Escape/backdrop. One request at a time: a
 * newer request cancels the one before it. Rendered by <DialogHost/> in the
 * root layout.
 */

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' styles the confirm button for destructive actions. */
  tone?: 'default' | 'danger';
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (confirmed: boolean) => void;
}

interface DialogState {
  request: ConfirmRequest | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

let nextId = 0;

export const useDialogStore = create<DialogState>((set, get) => ({
  request: null,

  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false);
      set({ request: { ...options, id: nextId++, resolve } });
    }),

  settle: (confirmed) => {
    const { request } = get();
    if (!request) return;
    set({ request: null });
    request.resolve(confirmed);
  },
}));

/** Ask from anywhere (event handlers, stores, helpers). */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useDialogStore.getState().ask(options);
}
