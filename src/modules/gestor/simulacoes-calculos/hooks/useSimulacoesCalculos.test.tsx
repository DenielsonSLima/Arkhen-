/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calcularMock = vi.hoisted(() => vi.fn());

vi.mock('../services/simulacoesRpcService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/simulacoesRpcService')>();
  return { ...actual, calcularSimulacaoRescisao: calcularMock };
});

import { useSimulacoesCalculos } from './useSimulacoesCalculos';

describe('useSimulacoesCalculos', () => {
  it('marca o resultado como indisponível enquanto a RPC está pendente', async () => {
    calcularMock.mockReturnValue(new Promise(() => undefined));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSimulacoesCalculos(), { wrapper });

    await waitFor(() => expect(calcularMock).toHaveBeenCalledOnce());
    expect(result.current.calculando).toBe(true);
    expect(result.current.resultadoCarregado).toBe(false);
    expect(result.current.relatorioDisponivel).toBe(false);
  });
});
