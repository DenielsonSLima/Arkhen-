/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const realtimeMock = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  removeChannel: vi.fn(),
}));

vi.mock('../../../../lib/realtimeChannel', () => ({
  subscribeRealtimeChannel: vi.fn((_scope: string, configure: (channel: any) => any) => {
    const channel = {
      on: vi.fn((_type: string, filter: { table: string }, callback: () => void) => {
        realtimeMock.callbacks.set(filter.table, callback);
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
    realtimeMock.callbacks.clear();
    realtimeMock.removeChannel.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('agrupa mudanças operacionais e atualiza o setup junto ao painel', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useInicioRealtime(true), { wrapper });

    expect(realtimeMock.callbacks.has('atividades_rotinas')).toBe(true);
    expect(realtimeMock.callbacks.has('atividades_tarefas')).toBe(true);
    expect(realtimeMock.callbacks.has('configuracoes_protocolos_empresas')).toBe(true);

    await act(async () => {
      realtimeMock.callbacks.get('atividades_rotinas')?.();
      realtimeMock.callbacks.get('atividades_tarefas')?.();
      realtimeMock.callbacks.get('configuracoes_protocolos_empresas')?.();
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inicio', 'dashboard'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inicio', 'vencimentos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['atividades', 'workspace'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inicio', 'setup'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['inicio'] });
    expect(invalidate).toHaveBeenCalledTimes(4);
    hook.unmount();
  });
});
