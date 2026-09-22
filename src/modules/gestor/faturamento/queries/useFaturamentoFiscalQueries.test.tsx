/** @vitest-environment jsdom */
import type { PropsWithChildren } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiscalDraft } from '../services/faturamentoFiscalTypes';
const mocks = vi.hoisted(() => ({ emit: vi.fn(), consult: vi.fn(), save: vi.fn() }));
vi.mock('../services/faturamentoFiscalService', () => ({ faturamentoFiscalService: mocks }));
import { useFiscalDraftMutations } from './useFaturamentoFiscalQueries';

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
describe('cache após operação fiscal vinculada à cobrança', () => {
  it.each(['emit', 'consult'] as const)('atualiza Financeiro, Faturamento e Início após %s inclusive resposta incerta', async operation => {
    for (const failed of [false, true]) {
      const client = new QueryClient({ defaultOptions: { mutations: { retry: 2 } } });
      const keys = [['financeiro', 'cobrancas'], ['faturamento', 'webiss'], ['inicio', 'dashboard']];
      keys.forEach(key => client.setQueryData(key, { stale: 'before-operation' }));
      const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
      const hook = renderHook(useFiscalDraftMutations, { wrapper });
      mocks[operation].mockReset();
      if (failed) mocks[operation].mockRejectedValue(new Error('Resposta fiscal incerta'));
      else mocks[operation].mockResolvedValue({ nfseId: '123', ambiente: 'homologacao' });
      await act(async () => {
        await hook.result.current[operation].mutateAsync({ id: 'draft-linked' } as FiscalDraft).catch(() => undefined);
      });
      expect(mocks[operation]).toHaveBeenCalledTimes(1);
      keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
      hook.unmount(); client.clear();
    }
  });
  it('salvar rascunho não invalida dados financeiros sem mutação bancária', async () => {
    const client = new QueryClient();
    client.setQueryData(['financeiro', 'cobrancas'], []);
    client.setQueryData(['faturamento', 'webiss'], []);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(useFiscalDraftMutations, { wrapper });
    mocks.save.mockResolvedValue({ id: 'draft' });
    await act(async () => { await hook.result.current.save.mutateAsync({} as never); });
    expect(client.getQueryState(['financeiro', 'cobrancas'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['faturamento', 'webiss'])?.isInvalidated).toBe(true);
    hook.unmount(); client.clear();
  });
});
