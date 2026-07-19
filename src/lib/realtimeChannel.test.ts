import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeChannelName, createRuntimeId } from './realtimeChannel';

describe('runtime identifiers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates unique channel names with the requested scope', () => {
    const names = Array.from({ length: 200 }, () => createRealtimeChannelName('atividades-realtime'));

    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => name.startsWith('atividades-realtime-'))).toBe(true);
  });

  it('falls back safely when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const first = createRuntimeId('bank-charge-request');
    const second = createRuntimeId('bank-charge-request');

    expect(first).toMatch(/^bank-charge-request-[0-9]+-[0-9]+$/);
    expect(second).not.toBe(first);
  });
});
