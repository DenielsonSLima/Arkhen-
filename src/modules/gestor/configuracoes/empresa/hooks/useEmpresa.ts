import { useState, useEffect, useRef } from 'react';
import { empresaService, mergeCnpjLookupIntoEmpresa } from '../services/empresaService';
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
  const resolvedCnpjRef = useRef('');

  useEffect(() => {
    if (empresaQuery.data) {
      setDados(empresaQuery.data);
      resolvedCnpjRef.current = empresaQuery.data.cnpj.replace(/\D/g, '');
    }
  }, [empresaQuery.data]);

  useEffect(() => {
    if (empresaQuery.error) {
      setErrorMsg('Erro ao carregar os dados da empresa no Supabase.');
    }
  }, [empresaQuery.error]);

  const handleInputChange = (field: keyof EmpresaDados, value: string | number | null) => {
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
      const requestedCnpj = dados.cnpj.replace(/\D/g, '');
      const isDifferentCnpj = resolvedCnpjRef.current !== requestedCnpj;
      
      setDados((prev) => {
        if (!prev) return null;
        return mergeCnpjLookupIntoEmpresa(prev, result, isDifferentCnpj);
      });
      resolvedCnpjRef.current = requestedCnpj;

      const hasCompleteAddress = Boolean(result.cep && result.endereco && result.cidade && result.estado);
      setSuccessMsg(hasCompleteAddress
        ? 'Dados cadastrais e endereço do CNPJ recuperados com sucesso!'
        : 'Dados cadastrais recuperados. A consulta não informou o endereço completo; revise os campos.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao buscar CNPJ.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!dados) return;

    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'empresa-logos', dados.cnpj || dados.nomeFantasia || 'empresa');
      handleInputChange('logoUrl', publicUrl);
      setSuccessMsg('Logo enviada. Salve os dados da empresa para confirmar.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const uploadError = err instanceof Error ? err : new Error('Erro ao enviar logo.');
      setErrorMsg(uploadError.message);
      setTimeout(() => setErrorMsg(null), 4000);
      throw uploadError;
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
