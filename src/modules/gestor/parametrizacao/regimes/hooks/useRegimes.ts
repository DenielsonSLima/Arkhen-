import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegimeTributario } from '../types';
import { regimesService } from '../services/regimesService';

const regimesQueryKey = ['parametrizacao', 'regimes'];

export const useRegimes = () => {
  const queryClient = useQueryClient();
  const [activeRegimeId, setActiveRegimeId] = useState<string>('mei');
  const [editingRegime, setEditingRegime] = useState<RegimeTributario | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const regimesQuery = useQuery({
    queryKey: regimesQueryKey,
    queryFn: () => regimesService.getRegimes(),
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (updatedRegime: RegimeTributario) => regimesService.saveRegime(updatedRegime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regimesQueryKey });
      setSuccessMsg('Regime tributario atualizado com sucesso!');
      setShowEditModal(false);
      setEditingRegime(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (error: Error) => {
      console.error('Erro ao salvar regime tributario:', error);
      setErrorMsg(error.message || 'Ocorreu um erro ao salvar as alteracoes.');
    },
  });

  const regimes = regimesQuery.data ?? [];
  const activeRegime = useMemo(
    () => regimes.find((regime) => regime.id === activeRegimeId) || regimes[0] || null,
    [activeRegimeId, regimes],
  );

  return {
    regimes,
    activeRegimeId,
    setActiveRegimeId,
    activeRegime,
    isLoading: regimesQuery.isLoading,
    isSaving: saveMutation.isPending,
    editingRegime,
    setEditingRegime,
    showEditModal,
    setShowEditModal,
    successMsg,
    errorMsg,
    handleSaveRegime: (updatedRegime: RegimeTributario) => saveMutation.mutate(updatedRegime),
    loadRegimes: () => queryClient.invalidateQueries({ queryKey: regimesQueryKey }),
  };
};
