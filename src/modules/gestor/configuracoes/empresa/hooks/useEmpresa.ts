import { useState, useEffect } from 'react';
import { empresaService } from '../services/empresaService';
import type { EmpresaDados } from '../services/empresaService';
import { useEmpresaQuery, useUpdateEmpresaMutation } from '../queries/useEmpresaQueries';
import { uploadImageAsset } from '../../../shared/uploadImageAsset';

export const useEmpresa = () => {
  const empresaQuery = useEmpresaQuery();
  const updateEmpresa = useUpdateEmpresaMutation();
  const [dados, setDados] = useState<EmpresaDados | null>(null);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (empresaQuery.data) {
      setDados(empresaQuery.data);
    }
  }, [empresaQuery.data]);

  useEffect(() => {
    if (empresaQuery.error) {
      setErrorMsg('Erro ao carregar os dados da empresa no Supabase.');
    }
  }, [empresaQuery.error]);

  const handleInputChange = (field: keyof EmpresaDados, value: string | null) => {
    if (!dados) return;
    setDados({
      ...dados,
      [field]: value,
    });
  };

  const handleLookupCnpj = async () => {
    if (!dados || !dados.cnpj) return;
    
    setIsSearchingCnpj(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const result = await empresaService.buscarCnpj(dados.cnpj);
      
      setDados((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...result,
        } as EmpresaDados;
      });

      setSuccessMsg('Dados cadastrais do CNPJ recuperados com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao buscar CNPJ.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleLogoUpload = async (file?: File) => {
    if (!dados || !file) return;

    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'empresa-logos', dados.cnpj || dados.nomeFantasia || 'empresa');
      handleInputChange('logoUrl', publicUrl);
      setSuccessMsg('Logo enviada. Salve os dados da empresa para confirmar.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar logo.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dados) return;

    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateEmpresa.mutateAsync(dados);
      setSuccessMsg('Dados da empresa salvos com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar as configurações.');
    } finally {
      updateEmpresa.reset();
    }
  };

  return {
    dados,
    isLoading: empresaQuery.isLoading,
    isSaving: updateEmpresa.isPending,
    isSearchingCnpj,
    successMsg,
    errorMsg,
    handleInputChange,
    handleLookupCnpj,
    handleLogoUpload,
    handleSave,
  };
};
