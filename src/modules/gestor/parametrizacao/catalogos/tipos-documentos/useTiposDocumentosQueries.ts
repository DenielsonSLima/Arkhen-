import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tiposDocumentosService, type SaveTipoDocumentoInput } from './tiposDocumentosService';

export const tiposDocumentosKeys = {
  all: ['parametrizacao', 'tipos-documentos'] as const,
};

export const useTiposDocumentosQuery = () => (
  useQuery({
    queryKey: tiposDocumentosKeys.all,
    queryFn: tiposDocumentosService.list,
  })
);

export const useSaveTipoDocumentoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveTipoDocumentoInput) => tiposDocumentosService.save(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tiposDocumentosKeys.all });
    },
  });
};

export const useToggleTipoDocumentoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => tiposDocumentosService.setAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tiposDocumentosKeys.all });
    },
  });
};
