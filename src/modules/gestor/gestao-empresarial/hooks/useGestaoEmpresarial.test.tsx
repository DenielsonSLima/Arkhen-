/** @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Company } from '../services/gestaoEmpresarialService';

const serviceMock = vi.hoisted(() => ({
  getCompanies: vi.fn(),
  saveCompany: vi.fn(),
  deleteCompany: vi.fn(),
  inativarCompany: vi.fn(),
  reativarCompany: vi.fn(),
  getCompanyDocumentCount: vi.fn(),
}));

vi.mock('../services/gestaoEmpresarialService', () => ({
  gestaoEmpresarialService: serviceMock,
}));

vi.mock('../services/cnpjLookupService', () => ({
  cnpjLookupService: { lookup: vi.fn() },
}));

vi.mock('../../../../lib/realtimeChannel', () => ({
  subscribeRealtimeChannel: vi.fn(() => null),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { removeChannel: vi.fn() },
}));

import { clientesKeys, useGestaoEmpresarial } from './useGestaoEmpresarial';

const company: Company = {
  id: 'cliente-1',
  nome: 'Empresa Matriz',
  razaoSocial: 'Empresa Matriz Ltda',
  cnpj: '12.345.678/0001-90',
  cnae: '6201-5/01',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  polos: [],
};

const createHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
};

const invalidatedKeys = (invalidateQueries: ReturnType<typeof vi.fn>) => (
  invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)
);

describe('useGestaoEmpresarial cache synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getCompanies.mockResolvedValue([company]);
    serviceMock.saveCompany.mockImplementation(async (value: Company) => value);
    serviceMock.deleteCompany.mockResolvedValue(undefined);
    serviceMock.inativarCompany.mockResolvedValue(undefined);
    serviceMock.reativarCompany.mockResolvedValue(undefined);
    serviceMock.getCompanyDocumentCount.mockResolvedValue(0);
  });

  it('invalida clientes e o diretório de Documentos após toda mutação de cliente', async () => {
    const { queryClient, Wrapper } = createHarness();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const { result } = renderHook(() => useGestaoEmpresarial(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const expectRelatedInvalidations = async (mutation: () => Promise<void>) => {
      invalidateQueries.mockClear();
      await act(async () => mutation());
      expect(invalidatedKeys(invalidateQueries)).toEqual([
        clientesKeys.all,
        ['documentos', 'companies'],
      ]);
    };

    await expectRelatedInvalidations(() => result.current.updateCompany(company));
    await expectRelatedInvalidations(() => result.current.inativarCompany(company.id));
    await expectRelatedInvalidations(() => result.current.reativarCompany(company.id));
    await expectRelatedInvalidations(() => result.current.deleteCompany(company.id));
  });
});
