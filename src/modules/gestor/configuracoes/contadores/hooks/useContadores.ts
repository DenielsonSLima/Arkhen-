import { useState, useEffect } from 'react';
import { contadoresService } from '../services/contadoresService';
import type { Contador } from '../services/contadoresService';

export const useContadores = () => {
  const [contadores, setContadores] = useState<Contador[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [crc, setCrc] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchContadores = async () => {
      try {
        const res = await contadoresService.getContadores();
        setContadores(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContadores();
  }, []);

  const handleToggleResponsavel = async (id: string) => {
    try {
      await contadoresService.setResponsavel(id);
      
      // Update local state: set target to responsavel, set others to false
      setContadores((prev) =>
        prev.map((c) => ({
          ...c,
          isResponsavel: c.id === id,
        }))
      );

      setSuccessMsg('Contador responsável alterado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !crc.trim() || !cpfCnpj.trim() || !email.trim()) return;

    setIsAdding(true);
    setSuccessMsg(null);

    try {
      const novoContador = await contadoresService.addContador({
        nome,
        crc,
        cpfCnpj,
        email,
      });

      setContadores((prev) => [...prev, novoContador]);
      setSuccessMsg(`Contador ${nome} cadastrado com sucesso!`);
      
      setNome('');
      setCrc('');
      setCpfCnpj('');
      setEmail('');
      setShowForm(false);
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  return {
    contadores,
    isLoading,
    isAdding,
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
