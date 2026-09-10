import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useFiscalQueries, useFiscalReadiness } from '../queries/useFiscalQueries';
import { fiscalIntegrationService } from '../services/fiscalIntegrationService';
import { DEFAULT_CONFIG, DEFAULT_STATS } from '../services/fiscalIntegrationDefaults';
import { groupContextsByLocation, makeContextKey } from '../services/fiscalIntegrationHelpers';
import { resolveCompanyName } from '../services/fiscalCompanyService';
import type { FiscalConfigData, FiscalMunicipalityContext, FiscalMunicipalityData } from '../services/fiscalIntegrationTypes';
import { useFiscalHistoryFilters } from './useFiscalHistoryFilters';

type FiscalTab = 'contexto' | 'resumo' | 'ambiente' | 'certificado' | 'rps' | 'historico';
type DiagnosticResult = { success: boolean; message: string };

export function useFiscalConfig() {
  const queries = useFiscalQueries();
  const [activeTab, setActiveTab] = useState<FiscalTab>('resumo');
  const [config, setConfig] = useState<FiscalConfigData>({ ...DEFAULT_CONFIG });
  const [activeContext, setActiveContext] = useState<FiscalMunicipalityContext | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [connectionResult, setConnectionResult] = useState<DiagnosticResult | null>(null);
  const [certResult, setCertResult] = useState<DiagnosticResult | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const companies = useMemo(() => queries.companies.data ?? [], [queries.companies.data]);
  const contexts = useMemo(() => queries.contexts.data ?? [], [queries.contexts.data]);
  const stored = contexts.find(item => item.context.key === activeContext?.key);
  const stats = stored?.stats ?? DEFAULT_STATS;
  const history = stored?.history ?? [];
  const historyFilters = useFiscalHistoryFilters(history);
  const availableUfs = useMemo(() => fiscalIntegrationService.getAvailableUfs(), []);
  const availableMunicipios = fiscalIntegrationService.getMunicipiosByUf(selectedUf);
  const selectedPrefeituraProfile = fiscalIntegrationService.getPrefeituraProfile(selectedUf, selectedMunicipio);
  const activePrefeituraProfile = activeContext ? fiscalIntegrationService.getPrefeituraProfile(activeContext.uf, activeContext.municipio) : null;
  const readiness = useFiscalReadiness(stored?.context ?? null, stored?.config ?? config);

  const applyPayload = (payload: FiscalMunicipalityData) => {
    setActiveContext({ ...payload.context, companyName: resolveCompanyName(payload.context.companyId, companies) });
    setConfig(payload.config);
  };
  const openContext = useCallback((context: FiscalMunicipalityContext) => {
    const existing = contexts.find(item => item.context.key === context.key);
    setSelectedCompanyId(context.companyId);
    setSelectedUf(context.uf);
    setSelectedMunicipio(context.municipio);
    setActiveContext({ ...context, companyName: resolveCompanyName(context.companyId, companies) });
    setConfig(existing?.config ?? { ...DEFAULT_CONFIG, provedor: fiscalIntegrationService.getPrefeituraProfile(context.uf, context.municipio)?.providerId ?? 'WebISS' });
    setActionError(null);
    setSyncResult(null);
    setConnectionResult(null);
    setCertResult(null);
    setSaveSuccess(false);
  }, [contexts, companies]);

  useEffect(() => {
    if (activeContext || !queries.companies.isSuccess || !queries.contexts.isSuccess) return;
    const active = contexts.find(item => item.context.isActive && item.context.companyId === 'office')
      ?? contexts.find(item => item.context.isActive);
    if (active) { openContext(active.context); return; }
    const first = companies[0];
    if (!first) return;
    const uf = first.uf || availableUfs[0] || 'SE';
    const municipio = first.cidade || fiscalIntegrationService.getMunicipiosByUf(uf)[0] || '';
    openContext({ key: makeContextKey({ companyId: first.id, uf, municipio }), companyId: first.id,
      companyName: first.nome || first.razaoSocial, uf, municipio, isActive: false });
  }, [queries.companies.isSuccess, queries.contexts.isSuccess, activeContext, contexts, companies, availableUfs, openContext]);

  const locationTree = useMemo(() => {
    const companyId = selectedCompanyId || 'office';
    const known = contexts.map(item => item.context).filter(item => item.companyId === companyId);
    return groupContextsByLocation(known);
  }, [contexts, selectedCompanyId]);

  const handleSelectCompany = (companyId: string) => {
    const company = companies.find(item => item.id === companyId);
    const uf = company?.uf || selectedUf || availableUfs[0] || 'SE';
    setSelectedCompanyId(companyId); setSelectedUf(uf);
    setSelectedMunicipio(company?.cidade || fiscalIntegrationService.getMunicipiosByUf(uf)[0] || '');
  };
  const handleSelectUf = (uf: string) => {
    setSelectedUf(uf); setSelectedMunicipio(fiscalIntegrationService.getMunicipiosByUf(uf)[0] || '');
  };
  const handleOpenDraftContext = () => {
    if (!selectedCompanyId || !selectedUf || !selectedMunicipio) return;
    const input = { companyId: selectedCompanyId, companyName: resolveCompanyName(selectedCompanyId, companies), uf: selectedUf, municipio: selectedMunicipio };
    const existing = contexts.find(item => item.context.key === makeContextKey(input));
    openContext(existing?.context ?? { ...input, key: makeContextKey(input), isActive: false });
  };
  const saveConfig = async (active: boolean) => {
    if (!activeContext) return;
    setActionError(null); setSaveSuccess(false);
    try {
      applyPayload(await queries.save.mutateAsync({ context: activeContext, config, active }));
      setSaveSuccess(true);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível salvar a configuração.'); }
  };
  const handleSaveConfig = async (event?: FormEvent) => { event?.preventDefault(); await saveConfig(activeContext?.isActive ?? false); };
  const handleToggleContextStatus = () => saveConfig(!activeContext?.isActive);
  const test = async (kind: 'connection' | 'certificate') => {
    if (!activeContext) return;
    const setResult = kind === 'connection' ? setConnectionResult : setCertResult;
    setResult(null);
    try { setResult(await queries.diagnostic.mutateAsync({ context: activeContext, config, kind })); }
    catch (error) { setResult({ success: false, message: error instanceof Error ? error.message : 'Não foi possível executar o diagnóstico.' }); }
  };
  const refreshLocal = async (kind: 'all' | 'last' | 'next') => {
    setSyncResult(null); setActionError(null);
    const result = await queries.contexts.refetch();
    if (result.error) { setActionError(result.error.message); return; }
    const data = result.data?.find(item => item.context.key === activeContext?.key);
    if (!data) { setActionError('Salve o contexto de emissão antes de consultar seus registros.'); return; }
    if (kind === 'last') setSyncResult(`Última NFS-e registrada no sistema: ${data.config.ultimoNumeroNfse || 'nenhuma'}. A prefeitura não foi consultada.`);
    else if (kind === 'next') setSyncResult(`Próximo RPS cadastrado: ${data.config.proximoNumeroRps || 'não definido'}. A numeração da NFS-e será atribuída pela prefeitura.`);
    else setSyncResult('Registros locais atualizados. No Financeiro, repetir a ação de emissão consulta automaticamente o RPS pendente antes de um novo envio.');
  };
  const uploadCertificateFile = async (file: File) => {
    if (!activeContext) return;
    if (!/\.(pfx|p12)$/i.test(file.name) || file.size > 3 * 1024 * 1024) {
      setCertResult({ success: false, message: 'Selecione um certificado .pfx ou .p12 de até 3 MB.' }); return;
    }
    if (!config.certificadoSenha || config.certificadoSenha === '••••••••') {
      setCertResult({ success: false, message: 'Informe a senha do certificado antes de enviar o arquivo.' }); return;
    }
    setCertResult(null);
    try {
      applyPayload(await queries.certificate.mutateAsync({ context: activeContext, config, file }));
      setCertResult({ success: true, message: 'Certificado recebido pelo servidor. Execute o teste de assinatura A1 para verificar sua utilização.' });
    } catch (error) { setCertResult({ success: false, message: error instanceof Error ? error.message : 'Não foi possível enviar o certificado.' }); }
  };
  const handleDrag = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); setDragActive(event.type !== 'dragleave');
  };
  const handleDrop = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); setDragActive(false);
    if (event.dataTransfer.files[0]) void uploadCertificateFile(event.dataTransfer.files[0]);
  };
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) void uploadCertificateFile(event.target.files[0]);
    event.target.value = '';
  };
  return {
    activeTab, setActiveTab, config, setConfig, stats, history, activeContext: stored?.context ? { ...stored.context, companyName: resolveCompanyName(stored.context.companyId, companies) } : activeContext,
    activePrefeituraProfile, ambienteLabel: config.ambiente === 'producao' ? 'Produção' : 'Homologação', ambienteConfig: activePrefeituraProfile?.ambientes?.[config.ambiente],
    saving: queries.save.isPending, saveSuccess, syncResult,
    loadError: actionError || queries.contexts.error?.message || queries.companies.error?.message || null,
    companies, selectedCompanyId, selectedUf, selectedMunicipio, availableUfs, availableMunicipios,
    selectedPrefeituraProfile, isLoadingSelection: queries.contexts.isPending || queries.companies.isPending,
    locationTree, openContext, handleSelectCompany, handleSelectUf, handleSelectMunicipio: setSelectedMunicipio,
    handleOpenDraftContext, handleToggleContextStatus, syncing: queries.contexts.isFetching,
    testingConnection: queries.diagnostic.isPending && queries.diagnostic.variables?.kind === 'connection',
    testingCert: queries.certificate.isPending || (queries.diagnostic.isPending && queries.diagnostic.variables?.kind === 'certificate'),
    connectionResult, certResult, handleTestConnection: () => test('connection'), handleTestCert: () => test('certificate'),
    handleSyncData: () => refreshLocal('all'), handleQueryLastNfse: () => refreshLocal('last'), handleQueryNextNum: () => refreshLocal('next'),
    dragActive, handleDrag, handleDrop, handleFileChange, handleSaveConfig,
    readiness, ...historyFilters,
  };
}
