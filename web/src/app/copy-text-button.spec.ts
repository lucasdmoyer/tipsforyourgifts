import { describe, expect, it, vi } from 'vitest';
import { copyText } from './copy-text-button';

describe('copyText', () => {
  it('copies the exact value without changing it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const value = 'Approve only refs/pull/104/merge. No production deployment.';

    await expect(copyText({ writeText }, value)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledExactlyOnceWith(value);
  });

  it('fails closed when the clipboard is missing', async () => {
    await expect(copyText({}, 'do not execute')).resolves.toBe('unavailable');
  });

  it('fails closed when the browser rejects clipboard access', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(copyText({ writeText }, 'do not execute')).resolves.toBe('unavailable');
  });
});
