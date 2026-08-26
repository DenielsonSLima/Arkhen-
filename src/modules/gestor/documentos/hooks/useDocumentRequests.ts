import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  documentRequestService,
  type CreateDocumentRequestInput,
  type DocumentRequest,
  type DocumentRequestStatus,
} from '../services/documentRequestService';
import { conformidadeKeys } from '../../conformidade/queries/conformidadeQueries';
import { invalidateAfterMutation } from '../../shared/mutationInvalidation';

export const documentRequestKeys = {
  all: ['documentos', 'solicitacoes'] as const,
  list: () => [...documentRequestKeys.all, 'lista'] as const,
  clients: () => [...documentRequestKeys.all, 'clientes'] as const,
  capabilities: () => [...documentRequestKeys.all, 'capacidades'] as const,
};

export const useDocumentRequests = () => {
  const queryClient = useQueryClient();
  const invalidateDocumentRequests = () => Promise.all([
    invalidateAfterMutation(queryClient, 'documentos'),
    queryClient.invalidateQueries({ queryKey: conformidadeKeys.all }),
  ]);
  const requestsQuery = useQuery({
    queryKey: documentRequestKeys.list(),
    queryFn: () => documentRequestService.list(),
    staleTime: 30_000,
    gcTime: 15 * 60_000,
  });
  const clientsQuery = useQuery({
    queryKey: documentRequestKeys.clients(),
    queryFn: () => documentRequestService.listClients(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const capabilitiesQuery = useQuery({
    queryKey: documentRequestKeys.capabilities(),
    queryFn: () => documentRequestService.getCapabilities(),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateDocumentRequestInput) => documentRequestService.create(input),
    onSuccess: (created) => {
      queryClient.setQueryData<DocumentRequest[]>(documentRequestKeys.list(), (current = []) => (
        [created, ...current]
      ));
      return invalidateDocumentRequests();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentRequestStatus }) => (
      documentRequestService.updateStatus(id, status)
    ),
    onSuccess: (updated) => {
      queryClient.setQueryData<DocumentRequest[]>(documentRequestKeys.list(), (current = []) => (
        current.map((request) => request.id === updated.id ? updated : request)
      ));
      return invalidateDocumentRequests();
    },
  });

  return {
    requests: requestsQuery.data ?? [],
    clients: clientsQuery.data ?? [],
    canCreate: capabilitiesQuery.data?.canCreate ?? false,
    canUpdate: capabilitiesQuery.data?.canUpdate ?? false,
    isLoading: requestsQuery.isLoading || clientsQuery.isLoading || capabilitiesQuery.isLoading,
    isError: requestsQuery.isError || clientsQuery.isError || capabilitiesQuery.isError,
    errorMessage: requestsQuery.error instanceof Error
      ? requestsQuery.error.message
      : clientsQuery.error instanceof Error
        ? clientsQuery.error.message
        : capabilitiesQuery.error instanceof Error
          ? capabilitiesQuery.error.message
          : '',
    createRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error instanceof Error ? createMutation.error.message : '',
    updateStatus: statusMutation.mutateAsync,
    updatingRequestId: statusMutation.isPending ? statusMutation.variables?.id || null : null,
    updateError: statusMutation.error instanceof Error ? statusMutation.error.message : '',
    retry: async () => {
      await Promise.all([requestsQuery.refetch(), clientsQuery.refetch(), capabilitiesQuery.refetch()]);
    },
  };
};
