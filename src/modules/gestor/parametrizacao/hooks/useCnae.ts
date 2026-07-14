import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cnaeCatalogQueryKey, parametrizacaoService } from '../services/parametrizacaoService';

export const useCnae = () => {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const cnaesQuery = useQuery({
    queryKey: cnaeCatalogQueryKey(true),
    queryFn: () => parametrizacaoService.getCnaes({ includeInactive: true }),
    staleTime: 5 * 60 * 1000,
  });

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => parametrizacaoService.toggleCnaeAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametrizacao', 'cnaes'] });
      showSuccess('Disponibilidade do CNAE atualizada.');
    },
  });

  const filteredCnaes = useMemo(() => {
    const list = cnaesQuery.data ?? [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((cnae) => (
      cnae.codigo.includes(q)
      || cnae.descricao.toLowerCase().includes(q)
      || cnae.meiOcupacoes.some((ocupacao) => ocupacao.toLowerCase().includes(q))
    ));
  }, [cnaesQuery.data, searchQuery]);

  return {
    cnaes: filteredCnaes,
    isLoading: cnaesQuery.isLoading,
    isSaving: toggleMutation.isPending,
    successMsg,
    errorMsg: cnaesQuery.error instanceof Error
      ? cnaesQuery.error.message
      : toggleMutation.error instanceof Error ? toggleMutation.error.message : null,
    searchQuery,
    setSearchQuery,
    handleToggleCnae: (id: string, ativo: boolean) => toggleMutation.mutate({ id, ativo }),
  };
};
