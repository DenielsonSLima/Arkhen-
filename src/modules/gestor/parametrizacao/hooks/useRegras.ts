import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrizacaoService } from '../services/parametrizacaoService';
import type { RegraImposto, RegraCnab } from '../services/parametrizacaoService';

const regrasQueryKey = ['parametrizacao', 'regras'];
const cnaeQueryKey = ['parametrizacao', 'cnaes'];

export const useRegras = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'impostos' | 'cnab'>('impostos');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showModalImposto, setShowModalImposto] = useState(false);
  const [showModalCnab, setShowModalCnab] = useState(false);
  const [editingRegraImposto, setEditingRegraImposto] = useState<RegraImposto | null>(null);
  const [editingRegraCnab, setEditingRegraCnab] = useState<RegraCnab | null>(null);

  const regrasImpostoQuery = useQuery({
    queryKey: [...regrasQueryKey, 'impostos'],
    queryFn: () => parametrizacaoService.getRegrasImposto(),
    staleTime: 5 * 60 * 1000,
  });

  const regrasCnabQuery = useQuery({
    queryKey: [...regrasQueryKey, 'cnab'],
    queryFn: () => parametrizacaoService.getRegrasCnab(),
    staleTime: 5 * 60 * 1000,
  });

  const cnaesQuery = useQuery({
    queryKey: cnaeQueryKey,
    queryFn: () => parametrizacaoService.getCnaes(),
    staleTime: 5 * 60 * 1000,
  });

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const invalidateRegras = () => queryClient.invalidateQueries({ queryKey: regrasQueryKey });

  const saveRegraImpostoMutation = useMutation({
    mutationFn: (data: RegraImposto) => parametrizacaoService.saveRegraImposto(data),
    onSuccess: (_, data) => {
      invalidateRegras();
      showSuccess(data.id ? 'Regra de imposto atualizada com sucesso!' : 'Regra de imposto criada com sucesso!');
      setShowModalImposto(false);
      setEditingRegraImposto(null);
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao salvar regra de imposto.'),
  });

  const deleteRegraImpostoMutation = useMutation({
    mutationFn: (id: string) => parametrizacaoService.deleteRegraImposto(id),
    onSuccess: () => {
      invalidateRegras();
      showSuccess('Regra de imposto inativada com sucesso!');
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao inativar regra de imposto.'),
  });

  const saveRegraCnabMutation = useMutation({
    mutationFn: (data: RegraCnab) => parametrizacaoService.saveRegraCnab(data),
    onSuccess: (_, data) => {
      invalidateRegras();
      showSuccess(data.id ? 'Regra CNAB atualizada com sucesso!' : 'Regra CNAB criada com sucesso!');
      setShowModalCnab(false);
      setEditingRegraCnab(null);
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao salvar regra CNAB.'),
  });

  const deleteRegraCnabMutation = useMutation({
    mutationFn: (id: string) => parametrizacaoService.deleteRegraCnab(id),
    onSuccess: () => {
      invalidateRegras();
      showSuccess('Regra CNAB inativada com sucesso!');
    },
    onError: (error: Error) => setErrorMsg(error.message || 'Falha ao inativar regra CNAB.'),
  });

  return {
    activeSubTab,
    setActiveSubTab,
    regrasImposto: regrasImpostoQuery.data ?? [],
    regrasCnab: regrasCnabQuery.data ?? [],
    cnaes: cnaesQuery.data ?? [],
    isLoading: regrasImpostoQuery.isLoading || regrasCnabQuery.isLoading || cnaesQuery.isLoading,
    isSaving:
      saveRegraImpostoMutation.isPending ||
      deleteRegraImpostoMutation.isPending ||
      saveRegraCnabMutation.isPending ||
      deleteRegraCnabMutation.isPending,
    successMsg,
    errorMsg,
    showModalImposto,
    setShowModalImposto,
    showModalCnab,
    setShowModalCnab,
    editingRegraImposto,
    setEditingRegraImposto,
    editingRegraCnab,
    setEditingRegraCnab,
    handleSaveRegraImposto: (data: RegraImposto) => saveRegraImpostoMutation.mutate(data),
    handleDeleteRegraImposto: (id: string) => deleteRegraImpostoMutation.mutate(id),
    handleSaveRegraCnab: (data: RegraCnab) => saveRegraCnabMutation.mutate(data),
    handleDeleteRegraCnab: (id: string) => deleteRegraCnabMutation.mutate(id),
  };
};
