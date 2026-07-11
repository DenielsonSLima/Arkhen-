import { useState } from 'react';
import type { ContaBancaria } from '../services/contasBancariasService';
import {
  useContasBancariasQuery,
  useContasBancariasResumoQuery,
  useDeleteContaBancariaMutation,
  useSaveContaBancariaMutation,
} from '../queries/useContasBancariasQueries';

export const useContasBancarias = () => {
  const contasQuery = useContasBancariasQuery();
  const resumoQuery = useContasBancariasResumoQuery();
  const saveContaMutation = useSaveContaBancariaMutation();
  const deleteContaMutation = useDeleteContaBancariaMutation();

  const [successMsgConta, setSuccessMsgConta] = useState<string | null>(null);
  const [errorMsgConta, setErrorMsgConta] = useState<string | null>(null);
  const [showModalConta, setShowModalConta] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null);

  const handleContaSave = async (dadosConta: Omit<ContaBancaria, 'saldoAtual'>) => {
    setSuccessMsgConta(null);
    setErrorMsgConta(null);

    try {
      await saveContaMutation.mutateAsync(dadosConta);
      setSuccessMsgConta(dadosConta.id ? 'Conta bancária atualizada com sucesso!' : 'Conta bancária adicionada com sucesso!');
      setShowModalConta(false);
      setEditingConta(null);
      setTimeout(() => setSuccessMsgConta(null), 3000);
    } catch (err) {
      setErrorMsgConta(err instanceof Error ? err.message : 'Ocorreu um erro ao salvar a conta.');
    }
  };

  const handleContaDelete = async (id: string) => {
    setSuccessMsgConta(null);
    setErrorMsgConta(null);

    try {
      await deleteContaMutation.mutateAsync(id);
      setSuccessMsgConta('Conta bancária removida com sucesso!');
      setTimeout(() => setSuccessMsgConta(null), 3000);
    } catch (err) {
      setErrorMsgConta(err instanceof Error ? err.message : 'Ocorreu um erro ao remover a conta.');
    }
  };

  return {
    contas: contasQuery.data || [],
    resumoContas: resumoQuery.data || { saldoInicial: 0, saldoAtual: 0, totalContas: 0 },
    isLoadingContas: contasQuery.isLoading || resumoQuery.isLoading,
    isSavingConta: saveContaMutation.isPending || deleteContaMutation.isPending,
    successMsgConta,
    errorMsgConta,
    editingConta,
    setEditingConta,
    showModalConta,
    setShowModalConta,
    handleContaSave,
    handleContaDelete,
  };
};
