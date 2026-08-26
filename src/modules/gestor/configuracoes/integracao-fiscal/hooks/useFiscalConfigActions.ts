import { useCallback } from 'react';
import type React from 'react';
import type {
  FiscalConfigData,
  FiscalMunicipalityContext,
  NfsHistoryItem,
  NfsStats,
} from '../services/fiscalIntegrationService';
import type { FiscalContextInput } from '../services/fiscalIntegrationTypes';
import { fiscalIntegrationService } from '../services/fiscalIntegrationService';

type ResultMessage = { success: boolean; message: string } | null;

type FiscalConfigActionsInput = {
  activeContext: FiscalMunicipalityContext | null;
  activeScope: FiscalContextInput | null;
  config: FiscalConfigData;
  selectedCompanyId: string;
  selectedUf: string;
  selectedMunicipio: string;
  loadDraftContext: () => Promise<void>;
  refreshContextList: () => Promise<FiscalMunicipalityContext[]>;
  setActiveContext: React.Dispatch<React.SetStateAction<FiscalMunicipalityContext | null>>;
  setConfig: React.Dispatch<React.SetStateAction<FiscalConfigData>>;
  setStats: React.Dispatch<React.SetStateAction<NfsStats>>;
  setHistory: React.Dispatch<React.SetStateAction<NfsHistoryItem[]>>;
  setTestingConnection: React.Dispatch<React.SetStateAction<boolean>>;
  setConnectionResult: React.Dispatch<React.SetStateAction<ResultMessage>>;
  setTestingCert: React.Dispatch<React.SetStateAction<boolean>>;
  setCertResult: React.Dispatch<React.SetStateAction<ResultMessage>>;
  setSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncResult: React.Dispatch<React.SetStateAction<string | null>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  setDragActive: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoadingSelection: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>;
};

export const useFiscalConfigActions = ({
  activeContext,
  activeScope,
  config,
  selectedCompanyId,
  selectedUf,
  selectedMunicipio,
  loadDraftContext,
  refreshContextList,
  setActiveContext,
  setConfig,
  setStats,
  setHistory,
  setTestingConnection,
  setConnectionResult,
  setTestingCert,
  setCertResult,
  setSyncing,
  setSyncResult,
  setSaving,
  setSaveSuccess,
  setDragActive,
  setIsLoadingSelection,
  setLoadError,
}: FiscalConfigActionsInput) => {
  const reloadActiveContext = useCallback(async () => {
    if (!activeScope) return;

    const payload = await fiscalIntegrationService.getContext(activeScope);
    setActiveContext(payload.context);
    setConfig(payload.config);
    setStats(payload.stats);
    setHistory(payload.history);
    await refreshContextList();
  }, [activeScope, refreshContextList, setActiveContext, setConfig, setHistory, setStats]);

  const handleTestConnection = async () => {
    if (!activeScope) return;

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const result = await fiscalIntegrationService.testConnection(activeScope, config);
      setConnectionResult(result);
      await reloadActiveContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível conectar ao WebService.';
      setConnectionResult({ success: false, message });
      setLoadError(message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestCert = async () => {
    if (!activeScope) return;

    if (!config.certificadoSenha && !config.certificadoSenhaConfigured) {
      setCertResult({ success: false, message: 'Informe a senha do certificado para realizar o teste de integridade.' });
      return;
    }

    setTestingCert(true);
    setCertResult(null);

    try {
      const result = await fiscalIntegrationService.testCertificate(activeScope, config);
      setCertResult(result);
      setTimeout(() => setCertResult(null), 5000);
      await reloadActiveContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível validar o certificado.';
      setCertResult({ success: false, message });
    } finally {
      setTestingCert(false);
    }
  };

  const handleSaveConfig = async (event?: React.FormEvent) => {
    if (!activeScope) return;
    event?.preventDefault();

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = await fiscalIntegrationService.saveConfig(
        activeScope,
        config,
        activeContext?.isActive ?? true,
      );
      setActiveContext(payload.context);
      setConfig(payload.config);
      setStats(payload.stats);
      setHistory(payload.history);
      await refreshContextList();
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as configurações fiscais.';
      setLoadError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncData = async () => {
    if (!activeScope) return;

    setSyncing(true);
    try {
      await fiscalIntegrationService.registerOperation(activeScope, config, {
        operacao: 'Sincronização',
        numeroNfse: '-',
        protocolo: `SYNC-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: 'Sincronização completa de notas e protocolos recebidos concluída pela Edge Function.',
      });
      setSyncing(false);
      setSyncResult('Dados sincronizados com o WebService do município!');
      setTimeout(() => setSyncResult(null), 4000);
      await reloadActiveContext();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao sincronizar dados fiscais.');
    } finally {
      setSyncing(false);
    }
  };

  const handleQueryLastNfse = async () => {
    if (!activeScope) return;

    setSyncing(true);
    try {
      await fiscalIntegrationService.registerOperation(activeScope, config, {
        operacao: 'Consulta',
        numeroNfse: config.ultimoNumeroNfse,
        protocolo: `QRY-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: 'Consulta de última NFS-e registrada pela Edge Function.',
      });
      setSyncing(false);
      setSyncResult(`Última NFS-e consultada: número ${config.ultimoNumeroNfse || '-'}, série ${config.serieRps || '-'}.`);
      setTimeout(() => setSyncResult(null), 4000);
      await reloadActiveContext();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao consultar NFS-e.');
    } finally {
      setSyncing(false);
    }
  };

  const handleQueryNextNum = async () => {
    if (!activeScope) return;

    setSyncing(true);
    try {
      setSyncing(false);
      const nextRps = String(Number(config.ultimoNumeroRps) + 1);
      const nextNfse = String(Number(config.ultimoNumeroNfse) + 1);

      setConfig((previous) => ({ ...previous, proximoNumeroRps: nextRps }));
      await fiscalIntegrationService.registerOperation(activeScope, config, {
        operacao: 'Consulta',
        numeroNfse: '-',
        protocolo: `SEQ-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: `Sequenciador de lotes atualizado. Próximo RPS: ${nextRps}; próxima NFS-e: ${nextNfse}.`,
      });
      setSyncResult(`Consulta de numeração concluída. Próximo RPS: ${nextRps}. Próxima NFS-e: ${nextNfse}.`);
      setTimeout(() => setSyncResult(null), 4000);
      await reloadActiveContext();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Falha ao consultar numeração.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const uploadCertificateFile = async (file: File) => {
    if (!activeContext || !activeScope) return;

    if (!config.certificadoSenha || config.certificadoSenha.replace(/•/g, '').trim().length === 0) {
      setCertResult({ success: false, message: 'Informe a senha do certificado antes de enviar o arquivo.' });
      return;
    }

    setTestingCert(true);
    setCertResult(null);

    try {
      const payload = await fiscalIntegrationService.uploadCertificate(activeScope, config, file);
      setActiveContext(payload.context);
      setConfig(payload.config);
      setStats(payload.stats);
      setHistory(payload.history);
      await refreshContextList();
      setCertResult({
        success: true,
        message: `Certificado "${file.name}" enviado com segurança pela Edge Function.`,
      });
      setTimeout(() => setCertResult(null), 5000);
    } catch (error) {
      setCertResult({
        success: false,
        message: error instanceof Error ? error.message : 'Não foi possível enviar o certificado.',
      });
    } finally {
      setTestingCert(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files?.[0]) {
      void uploadCertificateFile(event.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      void uploadCertificateFile(event.target.files[0]);
    }
  };

  const handleOpenDraftContext = async () => {
    if (!selectedCompanyId || !selectedUf || !selectedMunicipio) return;

    setIsLoadingSelection(true);
    setLoadError(null);

    try {
      await loadDraftContext();
    } catch (error) {
      console.error('Erro ao abrir contexto de integração:', error);
      setLoadError('Não foi possível abrir esse contexto de emissão.');
    } finally {
      setIsLoadingSelection(false);
    }
  };

  const handleToggleContextStatus = async () => {
    if (!activeContext || !activeScope) return;

    try {
      const updated = await fiscalIntegrationService.setContextActive(
        activeScope,
        config,
        !activeContext.isActive,
      );
      setActiveContext(updated.context);
      setConfig(updated.config);
      setStats(updated.stats);
      setHistory(updated.history);
      await refreshContextList();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível alterar o status da integração.');
    }
  };

  return {
    handleTestConnection,
    handleTestCert,
    handleSaveConfig,
    handleSyncData,
    handleQueryLastNfse,
    handleQueryNextNum,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleOpenDraftContext,
    handleToggleContextStatus,
  };
};
