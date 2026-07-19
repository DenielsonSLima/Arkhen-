/** @vitest-environment jsdom */

import { StrictMode, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ChangeCallback = () => void;
type FakeChannel = {
  callbacks: Map<string, ChangeCallback>;
  subscribed: boolean;
  on: (type: string, filter: { table: string }, callback: ChangeCallback) => FakeChannel;
  subscribe: () => FakeChannel;
};

const realtimeMock = vi.hoisted(() => ({
  channels: [] as Array<{ name: string; channel: FakeChannel }>,
  removed: [] as FakeChannel[],
  channel: vi.fn((name: string) => {
    const channel: FakeChannel = {
      callbacks: new Map(),
      subscribed: false,
      on(_type, filter, callback) {
        if (this.subscribed) throw new Error('cannot add callbacks after subscribe()');
        this.callbacks.set(filter.table, callback);
        return this;
      },
      subscribe() {
        this.subscribed = true;
        return this;
      },
    };
    realtimeMock.channels.push({ name, channel });
    return channel;
  }),
  removeChannel: vi.fn(async (channel: FakeChannel) => {
    realtimeMock.removed.push(channel);
    return 'ok';
  }),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    channel: realtimeMock.channel,
    removeChannel: realtimeMock.removeChannel,
  },
}));

import { useFaturamentoRealtime } from './useFaturamentoRealtime';

describe('useFaturamentoRealtime', () => {
  beforeEach(() => {
    realtimeMock.channels.length = 0;
    realtimeMock.removed.length = 0;
    realtimeMock.channel.mockClear();
    realtimeMock.removeChannel.mockClear();
  });

  it('cria canais únicos em montagens concorrentes e remove cada assinatura', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <StrictMode><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StrictMode>
    );

    const firstHook = renderHook(() => useFaturamentoRealtime(), { wrapper });
    const secondHook = renderHook(() => useFaturamentoRealtime(), { wrapper });
    const names = realtimeMock.channels.map(({ name }) => name);

    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(new Set(names).size).toBe(names.length);
    firstHook.unmount();
    secondHook.unmount();
    expect(realtimeMock.removeChannel).toHaveBeenCalled();
  });

  it('invalida apenas Faturamento e cobranças quando uma cobrança muda', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useFaturamentoRealtime(), { wrapper });
    const channel = realtimeMock.channels.at(-1)?.channel;

    await act(async () => {
      channel?.callbacks.get('financeiro_cobrancas')?.();
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['faturamento'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['financeiro', 'cobrancas'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['financeiro'] });
    hook.unmount();
  });
});
