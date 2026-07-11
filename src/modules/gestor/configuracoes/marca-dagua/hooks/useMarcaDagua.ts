import { useState, useEffect } from 'react';
import type { MarcaDaguaDados } from '../services/marcaDaguaService';
import { useMarcaDaguaQuery, useUpdateMarcaDaguaMutation } from '../queries/useMarcaDaguaQueries';
import { uploadImageAsset } from '../../../shared/uploadImageAsset';

export const useMarcaDagua = () => {
  const marcaDaguaQuery = useMarcaDaguaQuery();
  const updateMarcaDagua = useUpdateMarcaDaguaMutation();
  const [config, setConfig] = useState<MarcaDaguaDados | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploadingLand, setIsUploadingLand] = useState(false);
  const [isUploadingPort, setIsUploadingPort] = useState(false);

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

  const handleUploadLandscape = async (file: File) => {
    if (!config) return;
    setIsUploadingLand(true);
    setErrorMsg(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'watermarks-landscape', `empresa-${Date.now()}`);
      setConfig({ ...config, fileUrlPaisagem: publicUrl });
      setSuccessMsg('Marca d\'Água Paisagem carregada com sucesso! Lembre-se de salvar.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fazer upload da marca dágua paisagem.');
    } finally {
      setIsUploadingLand(false);
    }
  };

  const handleUploadPortrait = async (file: File) => {
    if (!config) return;
    setIsUploadingPort(true);
    setErrorMsg(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'watermarks-portrait', `empresa-${Date.now()}`);
      setConfig({ ...config, fileUrlRetrato: publicUrl });
      setSuccessMsg('Marca d\'Água Retrato carregada com sucesso! Lembre-se de salvar.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fazer upload da marca dágua retrato.');
    } finally {
      setIsUploadingPort(false);
    }
  };

  const handleSizeChange = (val: number) => {
    if (!config) return;
    setConfig({ ...config, tamanho: val });
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
    isSaving: updateMarcaDagua.isPending || isUploadingLand || isUploadingPort,
    isUploadingLand,
    isUploadingPort,
    successMsg,
    errorMsg,
    handleToggle,
    handlePosChange,
    handleOpacityChange,
    handleSizeChange,
    handleUploadLandscape,
    handleUploadPortrait,
    handleSave,
  };
};
