import { afterEach, describe, expect, it } from 'vitest';

import { confirmDialog, useDialogStore } from './dialogStore';

afterEach(() => useDialogStore.getState().settle(false));

describe('confirmDialog', () => {
  it('resolves with the settled answer and clears the request', async () => {
    const answer = confirmDialog({ title: 'Delete case?' });
    expect(useDialogStore.getState().request?.title).toBe('Delete case?');
    useDialogStore.getState().settle(true);
    await expect(answer).resolves.toBe(true);
    expect(useDialogStore.getState().request).toBeNull();
  });

  it('cancels a pending request when a newer one arrives', async () => {
    const first = confirmDialog({ title: 'First' });
    const second = confirmDialog({ title: 'Second' });
    await expect(first).resolves.toBe(false);
    expect(useDialogStore.getState().request?.title).toBe('Second');
    useDialogStore.getState().settle(false);
    await expect(second).resolves.toBe(false);
  });

  it('ignores a settle with nothing pending', () => {
    expect(() => useDialogStore.getState().settle(true)).not.toThrow();
  });
});
