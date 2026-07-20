import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeChannelName, createRuntimeId, subscribeRealtimeChannel } from './realtimeChannel';

vi.mock('./supabase', () => ({
  supabase: {
    channel: vi.fn((name: string) => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      name,
    })),
    removeChannel: vi.fn(),
  },
}));

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

  it('subscribes to realtime channel safely without errors', () => {
    const channel = subscribeRealtimeChannel('test-scope', (ch) => ch.on('postgres_changes', {}, () => {}));
    expect(channel).toBeDefined();
  });
});
