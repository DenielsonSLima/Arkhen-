/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const realtimeMock = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
  removeChannel: vi.fn(),
}));

vi.mock('../../../../lib/realtimeChannel', () => ({
  subscribeRealtimeChannel: vi.fn((_scope: string, configure: (channel: any) => any) => {
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
        realtimeMock.callbacks.push(callback);
        return channel;
      }),
    };
    return configure(channel);
  }),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { removeChannel: realtimeMock.removeChannel },
}));

import { useInicioRealtime } from './useInicioRealtime';

describe('useInicioRealtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    realtimeMock.callbacks.length = 0;
    realtimeMock.removeChannel.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('agrupa mudanças de tarefas e atualiza painel, vencimentos e workspace', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useInicioRealtime(true), { wrapper });

    await act(async () => {
      realtimeMock.callbacks[0]?.();
      realtimeMock.callbacks[1]?.();
      realtimeMock.callbacks[1]?.();
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inicio', 'dashboard'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inicio', 'vencimentos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['atividades', 'workspace'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['inicio'] });
    expect(invalidate).toHaveBeenCalledTimes(3);
    hook.unmount();
  });
});
