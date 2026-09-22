/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { from, auth: { onAuthStateChange: vi.fn() } } }));
vi.mock('../../../../lib/realtimeChannel', () => ({ subscribeRealtimeChannel: () => null }));
import { gestaoEmpresarialService } from '../services/gestaoEmpresarialService';
import { useGestaoEmpresarial } from './useGestaoEmpresarial';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('preserva o bloqueio documental ao excluir pelo hook sem perder o contexto do serviço', async () => {
  vi.spyOn(gestaoEmpresarialService, 'getPartners').mockResolvedValue([]);
  const count = vi.spyOn(gestaoEmpresarialService, 'getCompanyDocumentCount').mockResolvedValue(2);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useGestaoEmpresarial(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await expect(result.current.deleteCompany('cliente')).rejects.toThrow('possui arquivos'); });
  expect(count).toHaveBeenCalledWith('cliente');
  expect(from).not.toHaveBeenCalled();
});
