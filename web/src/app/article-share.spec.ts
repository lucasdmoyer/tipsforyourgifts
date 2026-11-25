import { describe, expect, it, vi } from 'vitest';
import { articleShareUrl, shareGuide, type GuideShareData } from './article-share';

const data: GuideShareData = {
  title: 'A thoughtful gift guide',
  text: 'A simple way to recognize the right recipient.',
  url: articleShareUrl('example-guide')
};

describe('reader sharing', () => {
  it('builds a stable production article URL', () => {
    expect(data.url).toBe('https://tipsforyourgifts.web.app/blog/example-guide');
  });

  it('uses the native share surface without copying when it succeeds', async () => {
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    await expect(shareGuide({ share, writeText }, data, true)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying when native sharing is unavailable', async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(shareGuide({ writeText }, data, true)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it('does not copy after the reader cancels the native share sheet', async () => {
    const share = vi.fn(async () => { throw { name: 'AbortError' }; });
    const writeText = vi.fn(async () => undefined);
    await expect(shareGuide({ share, writeText }, data, true)).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('fails closed when neither share mechanism works', async () => {
    await expect(shareGuide({}, data, false)).resolves.toBe('unavailable');
    await expect(shareGuide({ writeText: async () => { throw new Error('denied'); } }, data, false)).resolves.toBe('unavailable');
  });
});
