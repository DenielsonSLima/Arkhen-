import { useCallback, useEffect, useMemo, useState } from 'react';
import { empresaService } from '../../empresa/services/empresaService';
import {
  gestaoEmpresarialService,
  type Company,
} from '../../../gestao-empresarial/services/gestaoEmpresarialService';
import type {
  FiscalConfigData,
  FiscalMunicipalityContext,
  NfsHistoryItem,
  NfsStats,
} from '../services/fiscalIntegrationService';
import { fiscalIntegrationService } from '../services/fiscalIntegrationService';
import {
  buildFiscalLocationTree,
  buildOfficeCompanyFromDados,
  filterFiscalHistory,
  getDefaultUf,
  hasSameCompanySnapshot,
  INITIAL_FISCAL_CONFIG,
  INITIAL_NFS_STATS,
  mapToCompanyRecord,
  resolveCompanyName,
  type FiscalTab,
} from '../fiscalConfigModel';
import { useFiscalConfigActions } from './useFiscalConfigActions';

export const useFiscalConfigController = () => {
  const [activeTab, setActiveTab] = useState<FiscalTab>('resumo');
  const [config, setConfig] = useState<FiscalConfigData>(INITIAL_FISCAL_CONFIG);
  const [stats, setStats] = useState<NfsStats>(INITIAL_NFS_STATS);
  const [history, setHistory] = useState<NfsHistoryItem[]>([]);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingCert, setTestingCert] = useState(false);
  const [certResult, setCertResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [filterPeriodoInicio, setFilterPeriodoInicio] = useState('');
  const [filterPeriodoFim, setFilterPeriodoFim] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterNotaNum, setFilterNotaNum] = useState('');
  const [filterOperacao, setFilterOperacao] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [fiscalContexts, setFiscalContexts] = useState<FiscalMunicipalityContext[]>([]);
  const [activeContext, setActiveContext] = useState<FiscalMunicipalityContext | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const locationTree = useMemo(
    () => buildFiscalLocationTree(selectedCompanyId, companies, fiscalContexts),
    [companies, fiscalContexts, selectedCompanyId],
  );
  const selectedPrefeituraProfile = useMemo(
    () => fiscalIntegrationService.getPrefeituraProfile(selectedUf, selectedMunicipio),
    [selectedMunicipio, selectedUf],
  );
  const activePrefeituraProfile = useMemo(
    () => activeContext
      ? fiscalIntegrationService.getPrefeituraProfile(activeContext.uf, activeContext.municipio)
      : null,
    [activeContext],
  );
  const availableUfs = useMemo(() => fiscalIntegrationService.getAvailableUfs(), []);
  const availableMunicipios = useMemo(
    () => fiscalIntegrationService.getMunicipiosByUf(selectedUf),
    [selectedUf],
  );

  const resolveContextCompanyName = useCallback((context: FiscalMunicipalityContext) => {
    const companyName = resolveCompanyName(context.companyId, companies);
    return companyName || context.companyName || 'Empresa de emissão';
  }, [companies]);

  const refreshContextList = useCallback(async () => {
    const contexts = await fiscalIntegrationService.getContextList();
    setFiscalContexts(contexts);
    return contexts;
  }, []);

  const loadContextData = useCallback(async (nextContext: FiscalMunicipalityContext) => {
    try {
      setLoadError(null);
      const companyName = resolveContextCompanyName(nextContext);
      const payload = await fiscalIntegrationService.getContext({
        companyId: nextContext.companyId,
        companyName,
        uf: nextContext.uf,
        municipio: nextContext.municipio,
      });

      setActiveContext(payload.context);
      setConfig(payload.config);
      setStats(payload.stats);
      setHistory(payload.history);
      await refreshContextList();
    } catch (error) {
      console.error('Erro ao abrir integração fiscal:', error);
      setLoadError('Não foi possível carregar essa configuração de integração fiscal. Tente novamente.');
    }
  }, [refreshContextList, resolveContextCompanyName]);

  const openContext = useCallback((context: FiscalMunicipalityContext) => {
    setSelectedCompanyId(context.companyId);
    setSelectedUf(context.uf);
    setSelectedMunicipio(context.municipio);
    const companyName = resolveContextCompanyName(context);
    void loadContextData({
      ...context,
      companyName: companyName || context.companyName,
    });
  }, [loadContextData, resolveContextCompanyName]);

  const handleSelectCompany = useCallback((companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    const nextUf = company?.uf || selectedUf || getDefaultUf();
    const municipios = fiscalIntegrationService.getMunicipiosByUf(nextUf);
    const nextMunicipio = company?.cidade || municipios[0] || selectedMunicipio;

    setSelectedCompanyId(companyId);
    setSelectedUf(nextUf);
    setSelectedMunicipio(nextMunicipio);
  }, [companies, selectedMunicipio, selectedUf]);

  const handleSelectUf = useCallback((uf: string) => {
    const municipios = fiscalIntegrationService.getMunicipiosByUf(uf);
    setSelectedUf(uf);
    setSelectedMunicipio((current) => (
      municipios.includes(current) ? current : municipios[0] || ''
    ));
  }, []);

  const handleSelectMunicipio = useCallback((municipio: string) => {
    setSelectedMunicipio(municipio);
  }, []);

  const loadDraftContext = useCallback(async () => {
    if (!selectedCompanyId || !selectedUf || !selectedMunicipio) return;

    const company = companies.find((item) => item.id === selectedCompanyId);
    const companyName = company
      ? (company.nome || company.razaoSocial)
      : resolveCompanyName(selectedCompanyId, companies);
    await loadContextData({
      key: '',
      companyId: selectedCompanyId,
      companyName,
      uf: selectedUf,
      municipio: selectedMunicipio,
      isActive: true,
    });
  }, [companies, loadContextData, selectedCompanyId, selectedMunicipio, selectedUf]);

  const activeScope = useMemo(() => {
    if (!activeContext) return null;

    return {
      companyId: activeContext.companyId,
      companyName: activeContext.companyName,
      uf: activeContext.uf,
      municipio: activeContext.municipio,
    };
  }, [activeContext]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [loadedOffice, clientCompanies, contexts] = await Promise.all([
          empresaService.getDadosEmpresa(),
          gestaoEmpresarialService.getCompanies(),
          fiscalIntegrationService.getContextList(),
        ]);
        const officeCompany = buildOfficeCompanyFromDados(loadedOffice);
        const normalizedCompanies = [
          mapToCompanyRecord(officeCompany),
          ...clientCompanies.filter((item) => item.status === 'Ativa'),
        ];
        const officeName = resolveCompanyName(officeCompany.id, normalizedCompanies);
        const loadedCompanies = normalizedCompanies;
        const active = contexts.find((item) => item.isActive && item.companyId === officeCompany.id)
          || contexts.find((item) => item.isActive)
          || null;

        setCompanies((previous) => (
          hasSameCompanySnapshot(previous, loadedCompanies) ? previous : loadedCompanies
        ));
        setFiscalContexts(contexts);

        if (active) {
          const activeCompanyName = resolveCompanyName(active.companyId, loadedCompanies);
          setSelectedCompanyId(active.companyId);
          setSelectedUf(active.uf);
          setSelectedMunicipio(active.municipio);
          await loadContextData({
            ...active,
            companyName: activeCompanyName || officeName,
          });
          return;
        }

        const firstCompany = loadedCompanies[0];
        if (firstCompany) {
          const uf = firstCompany.uf || getDefaultUf();
          const municipio = firstCompany.cidade
            || fiscalIntegrationService.getMunicipiosByUf(uf)[0]
            || '';
          const firstCompanyName = resolveCompanyName(firstCompany.id, loadedCompanies);

          setSelectedCompanyId(firstCompany.id);
          setSelectedUf(uf);
          setSelectedMunicipio(municipio);
          await loadContextData({
            key: '',
            companyId: firstCompany.id,
            companyName: firstCompanyName,
            uf,
            municipio,
            isActive: true,
          });
          return;
        }

        const fallbackUf = getDefaultUf();
        const fallbackMunicipio = fiscalIntegrationService.getMunicipiosByUf(fallbackUf)[0]
          || 'Não informado';
        const fallbackContext = {
          key: '',
          companyId: 'office',
          companyName: 'Escritório (contabilidade)',
          uf: fallbackUf,
          municipio: fallbackMunicipio,
          isActive: true,
        };

        await loadContextData(fallbackContext);
        setSelectedCompanyId(fallbackContext.companyId);
        setSelectedUf(fallbackContext.uf);
        setSelectedMunicipio(fallbackContext.municipio);
      } catch (error) {
        console.error('Erro ao inicializar módulo de integração fiscal:', error);
        setLoadError('Não foi possível iniciar o módulo no momento. Tente novamente em instantes.');
      }
    };

    void initialize();
  }, [loadContextData]);

  const actions = useFiscalConfigActions({
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
  });

  const filteredHistory = useMemo(() => filterFiscalHistory(history, {
    periodoInicio: filterPeriodoInicio,
    periodoFim: filterPeriodoFim,
    status: filterStatus,
    notaNum: filterNotaNum,
    operacao: filterOperacao,
    searchQuery,
  }), [filterNotaNum, filterOperacao, filterPeriodoFim, filterPeriodoInicio, filterStatus, history, searchQuery]);

  return {
    activeTab,
    setActiveTab,
    config,
    setConfig,
    stats,
    history,
    testingConnection,
    connectionResult,
    testingCert,
    certResult,
    syncing,
    syncResult,
    saving,
    saveSuccess,
    showCertModal,
    setShowCertModal,
    dragActive,
    filterPeriodoInicio,
    setFilterPeriodoInicio,
    filterPeriodoFim,
    setFilterPeriodoFim,
    filterStatus,
    setFilterStatus,
    filterNotaNum,
    setFilterNotaNum,
    filterOperacao,
    setFilterOperacao,
    searchQuery,
    setSearchQuery,
    companies,
    activeContext,
    selectedCompanyId,
    selectedUf,
    selectedMunicipio,
    isLoadingSelection,
    loadError,
    locationTree,
    selectedPrefeituraProfile,
    activePrefeituraProfile,
    availableUfs,
    availableMunicipios,
    filteredHistory,
    openContext,
    handleSelectCompany,
    handleSelectUf,
    handleSelectMunicipio,
    ...actions,
  };
};

export type FiscalConfigController = ReturnType<typeof useFiscalConfigController>;
