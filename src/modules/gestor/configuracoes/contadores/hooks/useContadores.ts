import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  useAddContadorMutation,
  useContadoresQuery,
  useSetContadorResponsavelMutation,
} from '../queries/useContadoresQueries';

export const useContadores = () => {
  const contadoresQuery = useContadoresQuery();
  const addContadorMutation = useAddContadorMutation();
  const setResponsavelMutation = useSetContadorResponsavelMutation();

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [crc, setCrc] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggleResponsavel = async (id: string) => {
    try {
      await setResponsavelMutation.mutateAsync(id);
      setSuccessMsg('Contador responsável alterado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !crc.trim() || !cpfCnpj.trim() || !email.trim()) return;

    setSuccessMsg(null);

    try {
      await addContadorMutation.mutateAsync({
        nome,
        crc,
        cpfCnpj,
        email,
      });

      setSuccessMsg(`Contador ${nome} cadastrado com sucesso!`);
      setNome('');
      setCrc('');
      setCpfCnpj('');
      setEmail('');
      setShowForm(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return {
    contadores: contadoresQuery.data || [],
    isLoading: contadoresQuery.isLoading,
    isAdding: addContadorMutation.isPending,
    showForm,
    setShowForm,
    nome,
    setNome,
    crc,
    setCrc,
    cpfCnpj,
    setCpfCnpj,
    email,
    setEmail,
    successMsg,
    handleToggleResponsavel,
    handleAdd,
  };
};
