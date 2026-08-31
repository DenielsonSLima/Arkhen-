/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const realtimeMock = vi.hoisted(() => ({
  filter: null as string | null,
  callback: null as (() => void) | null,
  removeChannel: vi.fn(),
}));

const queryMock = vi.hoisted(() => ({
  serverConfig: null as unknown,
  save: vi.fn(),
}));

vi.mock('../../../../lib/realtimeChannel', () => ({
  subscribeRealtimeChannel: vi.fn((_scope: string, configure: (channel: any) => any) => {
    const channel = {
      on: vi.fn((_type: string, filter: { filter?: string }, callback: () => void) => {
        realtimeMock.filter = filter.filter || null;
        realtimeMock.callback = callback;
        return channel;
      }),
    };
    return configure(channel);
  }),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { removeChannel: realtimeMock.removeChannel },
}));

vi.mock('../queries/empresaProtocolosQueries', () => ({
  empresaProtocolosKeys: {
    detail: (clienteId: string) => ['protocolos', 'empresa-configuracao', clienteId],
  },
  empresaProtocolosQueries: {
    detail: (company: { id: string }) => ({
      queryKey: ['protocolos', 'empresa-configuracao', company.id],
      queryFn: () => Promise.resolve(queryMock.serverConfig),
      staleTime: 30_000,
    }),
    save: queryMock.save,
  },
}));

import { useEmpresaProtocolosConfiguracao } from './useEmpresaProtocolosConfiguracao';

const company = { id: '11111111-1111-4111-8111-111111111111' } as any;
const initialConfig = {
  catalogo: [],
  configs: [{ entregaId: 'xml-nfe', ativo: false, periodicidade: 'mensal' as const }],
};
const savedConfig = {
  ...initialConfig,
  configs: [{ entregaId: 'xml-nfe', ativo: true, periodicidade: 'quinzenal' as const }],
};

const createWrapper = (queryClient: QueryClient) => function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useEmpresaProtocolosConfiguracao', () => {
  beforeEach(() => {
    realtimeMock.filter = null;
    realtimeMock.callback = null;
    realtimeMock.removeChannel.mockClear();
    queryMock.serverConfig = initialConfig;
    queryMock.save.mockReset();
  });

  it('escuta somente a configuração do cliente aberto e remove o canal ao desmontar', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useEmpresaProtocolosConfiguracao(company), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(hook.result.current.data).toEqual(initialConfig));
    expect(realtimeMock.filter).toBe(`cliente_id=eq.${company.id}`);

    hook.unmount();
    expect(realtimeMock.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('mantém no cache a resposta canônica devolvida após salvar', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryMock.save.mockImplementation(async () => {
      queryMock.serverConfig = savedConfig;
      return savedConfig;
    });
    const hook = renderHook(() => useEmpresaProtocolosConfiguracao(company), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(hook.result.current.data).toEqual(initialConfig));
    let response: unknown;
    await act(async () => {
      response = await hook.result.current.saveConfiguracao(savedConfig.configs);
    });

    expect(response).toEqual(savedConfig);
    expect(queryClient.getQueryData(['protocolos', 'empresa-configuracao', company.id])).toEqual(savedConfig);
    expect(queryMock.save).toHaveBeenCalledWith(
      { company, configs: savedConfig.configs },
      expect.objectContaining({ client: queryClient }),
    );
  });
});
