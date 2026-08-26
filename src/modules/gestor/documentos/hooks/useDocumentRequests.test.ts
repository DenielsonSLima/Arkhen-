import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  mutationOptions: [] as Array<{ onSuccess?: (data: unknown) => void }>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
  useQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: (options: { onSuccess?: (data: unknown) => void }) => {
    mocks.mutationOptions.push(options);
    return {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      variables: undefined,
    };
  },
}));

vi.mock('../services/documentRequestService', () => ({
  documentRequestService: {
    list: vi.fn(),
    listClients: vi.fn(),
    getCapabilities: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

import { conformidadeKeys } from '../../conformidade/queries/conformidadeQueries';
import { mutationInvalidationKeys } from '../../shared/mutationInvalidation';
import { useDocumentRequests } from './useDocumentRequests';

const request = {
  id: '24d7f2e0-6c02-49b1-b229-03d8ca3752d9',
  clienteId: '3b93af38-f16e-4f53-b646-80731e744ef9',
  competencia: '2026-08',
  titulo: 'Extratos',
  descricao: '',
  dataLimite: '',
  status: 'Pendente',
  createdAt: '2026-08-26T00:00:00Z',
  updatedAt: '2026-08-26T00:00:00Z',
};

describe('useDocumentRequests — sincronização de caches relacionados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationOptions.length = 0;
  });

  it('invalida Documentos, Início e Conformidade após criar e alterar o status', () => {
    useDocumentRequests();

    expect(mocks.mutationOptions).toHaveLength(2);
    mocks.mutationOptions[0].onSuccess?.(request);
    mocks.mutationOptions[1].onSuccess?.({ ...request, status: 'Recebido' });

    expect(mocks.invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)).toEqual([
      ...mutationInvalidationKeys.documentos,
      conformidadeKeys.all,
      ...mutationInvalidationKeys.documentos,
      conformidadeKeys.all,
    ]);
  });
});
