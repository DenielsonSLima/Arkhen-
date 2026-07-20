import { describe, expect, it, vi } from 'vitest';
import { enqueueDocumentPreview } from './documentPreviewQueue';

describe('documentPreviewQueue', () => {
  it('limits expensive PDF rendering to two concurrent jobs', async () => {
    const releases: Array<() => void> = [];
    const started = vi.fn();
    const createJob = (id: number) => enqueueDocumentPreview(async () => {
      started(id);
      await new Promise<void>((resolve) => releases.push(resolve));
    });

    const first = createJob(1);
    const second = createJob(2);
    const third = createJob(3);

    expect(started.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    releases.shift()?.();
    await first;
    expect(started.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);

    releases.splice(0).forEach((release) => release());
    await Promise.all([second, third]);
  });
});
