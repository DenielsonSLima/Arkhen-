import { useState, useEffect } from 'react';
import type { MarcaDaguaDados } from '../services/marcaDaguaService';
import { useMarcaDaguaQuery, useUpdateMarcaDaguaMutation } from '../queries/useMarcaDaguaQueries';

export const useMarcaDagua = () => {
  const marcaDaguaQuery = useMarcaDaguaQuery();
  const updateMarcaDagua = useUpdateMarcaDaguaMutation();
  const [config, setConfig] = useState<MarcaDaguaDados | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (marcaDaguaQuery.data) {
      setConfig(marcaDaguaQuery.data);
    }
  }, [marcaDaguaQuery.data]);

  useEffect(() => {
    if (marcaDaguaQuery.error) {
      setErrorMsg("Erro ao carregar a marca d'água no Supabase.");
    }
  }, [marcaDaguaQuery.error]);

  const handleToggle = (val: boolean) => {
    if (!config) return;
    setConfig({ ...config, habilitado: val });
  };

  const handlePosChange = (val: MarcaDaguaDados['posicao']) => {
    if (!config) return;
    setConfig({ ...config, posicao: val });
  };

  const handleOpacityChange = (val: number) => {
    if (!config) return;
    setConfig({ ...config, opacidade: val });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateMarcaDagua.mutateAsync(config);
      setSuccessMsg('Configurações da Marca d\'Água salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar a marca d'água.");
    }
  };

  return {
    config,
    isLoading: marcaDaguaQuery.isLoading,
    isSaving: updateMarcaDagua.isPending,
    successMsg,
    errorMsg,
    handleToggle,
    handlePosChange,
    handleOpacityChange,
    handleSave,
  };
};
