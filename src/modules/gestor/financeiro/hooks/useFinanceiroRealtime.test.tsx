/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RealtimeCallback = () => void;
type FakeChannel = {
  callbacks: Map<string, RealtimeCallback>;
  on: (type: string, filter: { table?: string }, callback: RealtimeCallback) => FakeChannel;
  subscribe: () => FakeChannel;
};

const realtimeMock = vi.hoisted(() => {
  const channels: FakeChannel[] = [];
  return {
    channels,
    channel: vi.fn(() => {
      const channel: FakeChannel = {
        callbacks: new Map(),
        on(_type, filter, callback) {
          this.callbacks.set(filter.table || '', callback);
          return this;
        },
        subscribe() {
          return this;
        },
      };
      channels.push(channel);
      return channel;
    }),
    removeChannel: vi.fn(async () => 'ok'),
  };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    channel: realtimeMock.channel,
    removeChannel: realtimeMock.removeChannel,
  },
}));

import { useFinanceiroRealtime } from './useFinanceiroRealtime';

const createHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidateSpy };
};

describe('useFinanceiroRealtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    realtimeMock.channels.length = 0;
    realtimeMock.channel.mockClear();
    realtimeMock.removeChannel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces event bursts and invalidates only affected query groups', () => {
    const { Wrapper, invalidateSpy } = createHarness();
    const hook = renderHook(() => useFinanceiroRealtime(), { wrapper: Wrapper });
    const channel = realtimeMock.channels.at(-1);

    act(() => {
      channel?.callbacks.get('financeiro_cobrancas')?.();
      channel?.callbacks.get('financeiro_cobrancas')?.();
      channel?.callbacks.get('financeiro_lancamentos')?.();
      vi.advanceTimersByTime(99);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(invalidateSpy).toHaveBeenCalledTimes(6);
    const keys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(['financeiro', 'cobrancas']));
    expect(keys).toContain(JSON.stringify(['financeiro', 'lancamentos']));
    expect(keys).toContain(JSON.stringify(['financeiro', 'dashboard']));
    expect(keys).toContain(JSON.stringify(['faturamento']));
    hook.unmount();
  });

  it('removes the channel and cancels pending invalidation on unmount', () => {
    const { Wrapper, invalidateSpy } = createHarness();
    const hook = renderHook(() => useFinanceiroRealtime(), { wrapper: Wrapper });
    const channel = realtimeMock.channels.at(-1);

    act(() => channel?.callbacks.get('financeiro_cobrancas')?.());
    hook.unmount();
    act(() => vi.runAllTimers());

    expect(realtimeMock.removeChannel).toHaveBeenCalledWith(channel);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
