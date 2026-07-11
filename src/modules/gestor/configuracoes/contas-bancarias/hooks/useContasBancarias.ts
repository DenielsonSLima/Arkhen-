import { useEffect, useState } from 'react';
import { contasBancariasService } from '../services/contasBancariasService';
import type { ContaBancaria } from '../services/contasBancariasService';

export const useContasBancarias = () => {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [isLoadingContas, setIsLoadingContas] = useState(true);
  const [isSavingConta, setIsSavingConta] = useState(false);
  const [successMsgConta, setSuccessMsgConta] = useState<string | null>(null);
  const [errorMsgConta, setErrorMsgConta] = useState<string | null>(null);
  const [showModalConta, setShowModalConta] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null);

  const fetchContas = async () => {
    setIsLoadingContas(true);
    try {
      const res = await contasBancariasService.getContas();
      setContas(res);
    } catch (err) {
      console.error('Erro ao carregar contas bancárias:', err);
    } finally {
      setIsLoadingContas(false);
    }
  };

  useEffect(() => {
    fetchContas();
  }, []);

  const handleContaSave = async (dadosConta: Omit<ContaBancaria, 'saldoAtual'>) => {
    setIsSavingConta(true);
    setSuccessMsgConta(null);
    setErrorMsgConta(null);

    try {
      await contasBancariasService.saveConta(dadosConta);
      setSuccessMsgConta(dadosConta.id ? 'Conta bancária atualizada com sucesso!' : 'Conta bancária adicionada com sucesso!');
      setShowModalConta(false);
      setEditingConta(null);
      await fetchContas();
      setTimeout(() => setSuccessMsgConta(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsgConta(err instanceof Error ? err.message : 'Ocorreu um erro ao salvar a conta.');
    } finally {
      setIsSavingConta(false);
    }
  };

  const handleContaDelete = async (id: string) => {
    try {
      await contasBancariasService.deleteConta(id);
      setSuccessMsgConta('Conta bancária removida com sucesso!');
      await fetchContas();
      setTimeout(() => setSuccessMsgConta(null), 3000);
    } catch (err) {
      console.error('Erro ao deletar conta:', err);
    }
  };

  return {
    contas,
    isLoadingContas,
    isSavingConta,
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
