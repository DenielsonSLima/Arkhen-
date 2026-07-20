/** @vitest-environment jsdom */

import { StrictMode, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeChannel = {
  callbacks: Array<() => void>;
  on: (type: string, filter: unknown, callback: () => void) => FakeChannel;
  subscribe: () => FakeChannel;
  subscribed: boolean;
};

const realtimeMock = vi.hoisted(() => {
  const channels = new Map<string, FakeChannel>();
  const removed: FakeChannel[] = [];

  return {
    channels,
    removed,
    channel: vi.fn((name: string) => {
      const existing = channels.get(name);
      if (existing) return existing;

      const channel: FakeChannel = {
        callbacks: [],
        subscribed: false,
        on(_type, _filter, callback) {
          if (this.subscribed) {
            throw new Error('cannot add callbacks after subscribe()');
          }
          this.callbacks.push(callback);
          return this;
        },
        subscribe() {
          this.subscribed = true;
          return this;
        },
      };
      channels.set(name, channel);
      return channel;
    }),
    removeChannel: vi.fn(async (channel: FakeChannel) => {
      removed.push(channel);
      return 'ok';
    }),
  };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    channel: realtimeMock.channel,
    removeChannel: realtimeMock.removeChannel,
  },
}));

vi.mock('./useAtividadesWorkspace', () => ({
  atividadesKeys: { all: ['atividades'] },
}));

import { useAtividadesRealtime } from './useAtividadesRealtime';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );
  };
};

describe('useAtividadesRealtime', () => {
  beforeEach(() => {
    realtimeMock.channels.clear();
    realtimeMock.removed.length = 0;
    realtimeMock.channel.mockClear();
    realtimeMock.removeChannel.mockClear();
  });

  it('uses a different channel for every effect mount', () => {
    const first = renderHook(() => useAtividadesRealtime(true), { wrapper: createWrapper() });
    const second = renderHook(() => useAtividadesRealtime(true), { wrapper: createWrapper() });

    const names = realtimeMock.channel.mock.calls.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(2);

    first.unmount();
    second.unmount();
  });

  it('keeps the subscription stable when the callback identity changes', async () => {
    vi.useFakeTimers();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const hook = renderHook(
      ({ onChange }) => useAtividadesRealtime(true, onChange),
      { initialProps: { onChange: firstCallback }, wrapper: createWrapper() },
    );
    const subscriptionsBeforeRerender = realtimeMock.channel.mock.calls.length;

    hook.rerender({ onChange: secondCallback });

    expect(realtimeMock.channel).toHaveBeenCalledTimes(subscriptionsBeforeRerender);
    const activeChannel = Array.from(realtimeMock.channels.values()).at(-1);
    expect(activeChannel).toBeDefined();

    await act(async () => {
      activeChannel?.callbacks.at(-1)?.();
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(firstCallback).not.toHaveBeenCalled();
    hook.unmount();
    vi.useRealTimers();
  });

  it('coalesces a realtime event burst into one expensive refresh', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const hook = renderHook(() => useAtividadesRealtime(true, onChange), { wrapper: createWrapper() });
    const activeChannel = Array.from(realtimeMock.channels.values()).at(-1);

    await act(async () => {
      activeChannel?.callbacks[0]?.();
      activeChannel?.callbacks[1]?.();
      activeChannel?.callbacks[2]?.();
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    hook.unmount();
    vi.useRealTimers();
  });
});
