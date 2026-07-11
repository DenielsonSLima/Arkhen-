import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrizacaoService } from '../services/parametrizacaoService';
import type { Cnae } from '../services/parametrizacaoService';

const cnaeQueryKey = ['parametrizacao', 'cnaes'];

export const useCnae = () => {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCnae, setEditingCnae] = useState<Cnae | null>(null);

  const cnaesQuery = useQuery({
    queryKey: cnaeQueryKey,
    queryFn: () => parametrizacaoService.getCnaes(),
    staleTime: 5 * 60 * 1000,
  });

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const saveMutation = useMutation({
    mutationFn: (cnae: Cnae) => parametrizacaoService.saveCnae(cnae),
    onSuccess: (_, cnae) => {
      queryClient.invalidateQueries({ queryKey: cnaeQueryKey });
      showSuccess(cnae.id ? 'CNAE atualizado com sucesso!' : 'CNAE cadastrado com sucesso!');
      setShowModal(false);
      setEditingCnae(null);
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao salvar CNAE.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => parametrizacaoService.deleteCnae(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cnaeQueryKey });
      showSuccess('CNAE inativado com sucesso!');
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao inativar CNAE.'),
  });

  const filteredCnaes = useMemo(() => {
    const list = cnaesQuery.data ?? [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((cnae) => cnae.codigo.includes(q) || cnae.descricao.toLowerCase().includes(q));
  }, [cnaesQuery.data, searchQuery]);

  return {
    cnaes: filteredCnaes,
    isLoading: cnaesQuery.isLoading,
    isSaving: saveMutation.isPending || deleteMutation.isPending,
    successMsg,
    errorMsg,
    searchQuery,
    setSearchQuery,
    editingCnae,
    setEditingCnae,
    showModal,
    setShowModal,
    handleSaveCnae: (cnae: Cnae) => saveMutation.mutate(cnae),
    handleDeleteCnae: (id: string) => deleteMutation.mutate(id),
  };
};
