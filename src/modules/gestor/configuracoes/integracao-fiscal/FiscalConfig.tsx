import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { empresaService, type EmpresaDados } from '../empresa/services/empresaService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type {
  FiscalConfigData,
  NfsStats,
  NfsHistoryItem,
  FiscalMunicipalityContext,
} from './services/fiscalIntegrationService';
import { fiscalIntegrationService } from './services/fiscalIntegrationService';
import './FiscalConfig.css';

import { FiscalResumo } from './components/FiscalResumo';
import { FiscalAmbiente } from './components/FiscalAmbiente';
import { FiscalCertificado } from './components/FiscalCertificado';
import { FiscalRps } from './components/FiscalRps';
import { FiscalHistory } from './components/FiscalHistory';
import { FiscalLocationDirectory } from './components/location/FiscalLocationDirectory';
import { FiscalLocationForm } from './components/cadastro/FiscalLocationForm';
import { FiscalConnectionPlaceholder } from './components/conexao/FiscalConnectionPlaceholder';
import { makeContextKey } from './services/fiscalIntegrationHelpers';

type FiscalTab = 'contexto' | 'resumo' | 'ambiente' | 'certificado' | 'rps' | 'historico';

type FiscalEmissorCompany = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  cidade?: string;
  uf?: string;
  contato?: string;
  email?: string;
};

const buildOfficeCompanyFromDados = (dados: EmpresaDados): FiscalEmissorCompany => ({
  id: 'office',
  nome: dados.nomeFantasia || dados.razaoSocial,
  razaoSocial: dados.razaoSocial,
  cnpj: dados.cnpj,
  cidade: dados.cidade,
  uf: dados.estado,
  contato: dados.email || dados.telefone,
  email: dados.email,
});

const mapToCompanyRecord = (officeCompany: FiscalEmissorCompany): Company => ({
  id: officeCompany.id,
  nome: officeCompany.nome,
  razaoSocial: officeCompany.razaoSocial,
  cnpj: officeCompany.cnpj,
  tipo: 'MEI',
  categoriaCliente: 'Contabilidade',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: officeCompany.email || '',
  telefone: officeCompany.contato || '',
  endereco: 'Configuração da empresa',
  cidade: officeCompany.cidade,
  uf: officeCompany.uf,
  cep: '',
  bairro: '',
  contato: officeCompany.contato || '',
  inscricaoEstadual: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  pastasDocumentos: [],
  categoriasDocumentos: [],
});


const resolveCompanyName = (companyId: string, companies: Company[]) => {
  if (companyId === 'office') {
    const office = companies.find((item) => item.id === 'office');
    if (office) {
      return office.nome || office.razaoSocial || 'Escritório (contabilidade)';
    }
  }

  const company = companies.find((item) => item.id === companyId);
  return company?.nome || company?.razaoSocial || 'Empresa de emissão';
};

const hasSameCompanySnapshot = (left: Company[], right: Company[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    if (item.id !== other.id) {
      return false;
    }

    return (
      (item.nome || item.razaoSocial) === (other.nome || other.razaoSocial)
      && (item.uf || '') === (other.uf || '')
      && (item.cidade || '') === (other.cidade || '')
    );
  });
};

const getDefaultUf = () => fiscalIntegrationService.getAvailableUfs()[0] || 'SP';

export const FiscalConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FiscalTab>('resumo');

  const [config, setConfig] = useState<FiscalConfigData>({
    ambiente: 'homologacao',
    provedor: 'WebISS',
    usuarioWebService: '',
    senhaWebService: '',
    certificadoSenha: '',
    certificadoNome: '',
    certificadoEmpresa: '',
    certificadoCNPJ: '',
    certificadoEmitidoEm: '',
    certificadoValidade: '',
    certificadoDiasRestantes: 0,
    serieRps: '',
    ultimoNumeroRps: '',
    proximoNumeroRps: '',
    ultimoNumeroNfse: '',
    codigoServico: '',
    itemListaServico: '',
    aliquotaIss: '',
    naturezaOperacao: '',
    regimeEspecial: '',
    incentivadorCultural: '',
    issRetido: '',
  });

  const [stats, setStats] = useState<NfsStats>({
    emitidas: 0,
    canceladas: 0,
    rejeitadas: 0,
    pendentes: 0,
    ultimaEmissao: '',
    ultimoCancelamento: '',
    proximoNumeroNfse: '',
    ultimoProtocolo: '',
  });

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
  const [activeContext, setActiveContext] = useState<FiscalMunicipalityContext | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const locationTree = useMemo(() => {
    try {
      const sanitize = (value: string) => {
        return (value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      };

      const normalizedCompanyId = selectedCompanyId || 'office';
      const selectedCompanyName = resolveCompanyName(normalizedCompanyId, companies);
      const allContexts = fiscalIntegrationService.getContextList().filter((context) => (
        !selectedCompanyId || context.companyId === selectedCompanyId
      ));
      const availableProfiles = fiscalIntegrationService.getAvailablePrefeituraProfiles();

      const grouped = new Map<string, Map<string, FiscalMunicipalityContext>>();

      const usedLocations = new Set<string>();

      availableProfiles.forEach((profile) => {
        const existing = allContexts.find(
          (context) => sanitize(context.uf) === sanitize(profile.uf) && sanitize(context.municipio) === sanitize(profile.municipio),
        );

        const context: FiscalMunicipalityContext = existing ? {
          ...existing,
          companyName: resolveCompanyName(existing.companyId, companies),
        } : {
          key: makeContextKey({
            companyId: normalizedCompanyId,
            uf: profile.uf,
            municipio: profile.municipio,
          }),
          companyId: normalizedCompanyId,
          companyName: selectedCompanyName,
          uf: profile.uf,
          municipio: profile.municipio,
          isActive: false,
        };

        const uf = (context.uf || 'NA').trim().toUpperCase();
        const municipio = context.municipio || 'Não informado';
        const normalizedUf = sanitize(uf);
        const normalizedMunicipio = sanitize(municipio);

        const ufMap = grouped.get(uf) || new Map<string, FiscalMunicipalityContext>();
        ufMap.set(normalizedMunicipio, context);
        grouped.set(uf, ufMap);
        usedLocations.add(`${normalizedUf}|${normalizedMunicipio}`);
      });

      allContexts.forEach((context) => {
        const normalizedUf = sanitize(context.uf);
        const normalizedMunicipio = sanitize(context.municipio);
        const key = `${normalizedUf}|${normalizedMunicipio}`;
        if (usedLocations.has(key)) {
          return;
        }

        const uf = (context.uf || 'NA').trim().toUpperCase();
        const ufMap = grouped.get(uf) || new Map<string, FiscalMunicipalityContext>();
        ufMap.set(normalizedMunicipio, {
          ...context,
          companyName: resolveCompanyName(context.companyId, companies),
        });
        grouped.set(uf, ufMap);
      });

      if (grouped.size === 0) {
        return [];
      }

      const baseTree = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([uf, municipios]) => ({
        uf,
        municipios: Array.from(municipios.entries())
          .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
          .map(([, context]) => ({
            municipio: context.municipio || 'Não informado',
            contexts: [context],
          })),
      }));

      return baseTree;
    } catch (error) {
      console.error('Erro ao carregar árvore de integrações:', error);
      return [];
    }
  }, [
    activeContext?.key,
    selectedCompanyId,
    companies,
  ]);
  const selectedPrefeituraProfile = useMemo(
    () => fiscalIntegrationService.getPrefeituraProfile(selectedUf, selectedMunicipio),
    [selectedMunicipio, selectedUf],
  );
  const activePrefeituraProfile = useMemo(
    () => activeContext ? fiscalIntegrationService.getPrefeituraProfile(activeContext.uf, activeContext.municipio) : null,
    [activeContext],
  );

  const resolveContextCompanyName = useCallback((context: FiscalMunicipalityContext) => {
    const companyName = resolveCompanyName(context.companyId, companies);
    return companyName || context.companyName || 'Empresa de emissão';
  }, [companies]);

  const loadContextData = useCallback((nextContext: FiscalMunicipalityContext) => {
    try {
      setLoadError(null);
      const companyName = resolveContextCompanyName(nextContext);

      const payload = fiscalIntegrationService.getContext({
        companyId: nextContext.companyId,
        companyName,
        uf: nextContext.uf,
        municipio: nextContext.municipio,
      });

      setActiveContext(payload.context);
      setConfig(payload.config);
      setStats(payload.stats);
        setHistory(payload.history);
    } catch (error) {
      console.error('Erro ao abrir integração fiscal:', error);
      setLoadError('Não foi possível carregar essa configuração de integração fiscal. Tente novamente.');
    }
  }, [resolveContextCompanyName]);

  const openContext = useCallback((context: FiscalMunicipalityContext) => {
    setSelectedCompanyId(context.companyId);
    setSelectedUf(context.uf);
    setSelectedMunicipio(context.municipio);
    const companyName = resolveContextCompanyName(context);
    loadContextData({
      ...context,
      companyName: companyName || context.companyName,
    });
  }, [loadContextData, resolveContextCompanyName]);

  const loadDraftContext = useCallback(() => {
    if (!selectedCompanyId || !selectedUf || !selectedMunicipio) {
      return;
    }

    const company = companies.find((item) => item.id === selectedCompanyId);
    const companyName = company ? (company.nome || company.razaoSocial) : resolveCompanyName(selectedCompanyId, companies);
    const nextContext: FiscalMunicipalityContext = {
      key: '',
      companyId: selectedCompanyId,
      companyName,
      uf: selectedUf,
      municipio: selectedMunicipio,
      isActive: true,
    };

    loadContextData(nextContext);
  }, [companies, loadContextData, selectedCompanyId, selectedMunicipio, selectedUf]);

  const activeScope = useMemo(() => {
    if (!activeContext) {
      return null;
    }

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
        const loadedOffice = await empresaService.getDadosEmpresa();
        const officeCompany = buildOfficeCompanyFromDados(loadedOffice);
        const normalizedCompanies = [mapToCompanyRecord(officeCompany)];
        const officeName = resolveCompanyName(officeCompany.id, normalizedCompanies);

        const loadedCompanies = normalizedCompanies;
        const contexts = fiscalIntegrationService.getContextList();
        const active = contexts.find((item) => item.isActive && item.companyId === officeCompany.id)
          || contexts.find((item) => item.isActive)
          || null;

        setCompanies((previous) => {
          if (hasSameCompanySnapshot(previous, loadedCompanies)) {
            return previous;
          }

          return loadedCompanies;
        });

        if (active) {
          const activeCompanyName = resolveCompanyName('office', loadedCompanies);
          setSelectedCompanyId(officeCompany.id);
          setSelectedUf(active.uf);
          setSelectedMunicipio(active.municipio);
          loadContextData({
            ...active,
            companyId: officeCompany.id,
            companyName: activeCompanyName || officeName,
          });
          return;
        }

        const firstCompany = loadedCompanies[0];
        if (firstCompany) {
          const uf = firstCompany.uf || getDefaultUf();
          const municipio = firstCompany.cidade || fiscalIntegrationService.getMunicipiosByUf(uf)[0] || '';
        const firstCompanyName = resolveCompanyName(firstCompany.id, loadedCompanies);

          setSelectedCompanyId(firstCompany.id);
          setSelectedUf(uf);
          setSelectedMunicipio(municipio);

          loadContextData({
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
        const fallbackMunicipio = fiscalIntegrationService.getMunicipiosByUf(fallbackUf)[0] || 'Não informado';

        const fallbackContext = {
          key: '',
          companyId: 'office',
          companyName: 'Escritório (contabilidade)',
          uf: fallbackUf,
          municipio: fallbackMunicipio,
          isActive: true,
        };

        loadContextData(fallbackContext);
        setSelectedCompanyId(fallbackContext.companyId);
        setSelectedUf(fallbackContext.uf);
        setSelectedMunicipio(fallbackContext.municipio);
      } catch (error) {
        console.error('Erro ao inicializar módulo de integração fiscal:', error);
        setLoadError('Não foi possível iniciar o módulo no momento. Tente novamente em instantes.');
      }
    };

    initialize();
  }, [loadContextData]);

  const handleTestConnection = async () => {
    if (!activeScope) {
      return;
    }

    setTestingConnection(true);
    setConnectionResult(null);

    const adapter = fiscalIntegrationService.getAdapter(config.provedor);
    setTimeout(async () => {
      try {
        const providerEndpoint = fiscalIntegrationService.getProfileEnvironmentUrl(
          activeScope.uf,
          activeScope.municipio,
          config.ambiente,
        );
        const res = await adapter.testConnection(config.usuarioWebService, config.senhaWebService);
        setConnectionResult(res);

        fiscalIntegrationService.addHistoryItem(activeScope, {
          operacao: 'Consulta',
          numeroNfse: '-',
          protocolo: `CONN-${Date.now().toString().slice(-6)}`,
          status: res.success ? 'Sucesso' : 'Erro',
          usuario: 'Administrador',
          mensagemPrefeitura: res.success
            ? `Webservice (${providerEndpoint || 'URL não mapeada'}) respondeu com status 200 OK.`
            : `Erro na validação das credenciais (${providerEndpoint || 'URL não mapeada'}): ${res.message}`
        });
        setHistory(fiscalIntegrationService.getHistory(activeScope));
      } catch {
        setConnectionResult({ success: false, message: 'Não foi possível conectar ao WebService.' });
      } finally {
        setTestingConnection(false);
      }
    }, 1500);
  };

  const handleTestCert = () => {
    if (!activeScope) {
      return;
    }

    if (!config.certificadoSenha) {
      alert('Informe a senha do certificado para realizar o teste de integridade.');
      return;
    }

    setTestingCert(true);
    setCertResult(null);

    setTimeout(() => {
      setTestingCert(false);
      setCertResult({
        success: true,
        message: `Certificado [${config.certificadoNome}] validado com sucesso e pronto para assinatura.`
      });
      setTimeout(() => setCertResult(null), 5000);

      fiscalIntegrationService.addHistoryItem(activeScope, {
        operacao: 'Consulta',
        numeroNfse: '-',
        protocolo: `CERT-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: 'Assinatura digital simulada com o certificado A1 realizada com sucesso.'
      });
      setHistory(fiscalIntegrationService.getHistory(activeScope));
    }, 1200);
  };

  const handleSaveConfig = (e?: React.FormEvent) => {
    if (!activeScope) {
      return;
    }

    if (e) {
      e.preventDefault();
    }

    setSaving(true);
    setSaveSuccess(false);

    setTimeout(() => {
      fiscalIntegrationService.saveConfig(activeScope, config);
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      fiscalIntegrationService.addHistoryItem(activeScope, {
        operacao: 'Sincronização',
        numeroNfse: '-',
        protocolo: `SAVE-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: 'Configurações fiscais atualizadas e salvas com sucesso no armazenamento local.'
      });
      setHistory(fiscalIntegrationService.getHistory(activeScope));
    }, 1000);
  };

  const handleSyncData = () => {
    if (!activeScope) {
      return;
    }

    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncResult('Dados sincronizados com o WebService do município!');
      setTimeout(() => setSyncResult(null), 4000);

      fiscalIntegrationService.addHistoryItem(activeScope, {
        operacao: 'Sincronização',
        numeroNfse: '-',
        protocolo: `SYNC-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: 'Sincronização completa de notas e protocolos recebidos concluída com sucesso.'
      });
      setHistory(fiscalIntegrationService.getHistory(activeScope));
    }, 1800);
  };

  const handleQueryLastNfse = () => {
    if (!activeScope) {
      return;
    }

    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      alert(`Última NFS-e retornada pelo município: Número ${config.ultimoNumeroNfse}, Série ${config.serieRps}, Código de Verificação: WEBISS-${Math.floor(1000000 + Math.random() * 9000000)}`);

      fiscalIntegrationService.addHistoryItem(activeScope, {
        operacao: 'Consulta',
        numeroNfse: config.ultimoNumeroNfse,
        protocolo: `QRY-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: `Consulta de NFS-e avulsa retornada com sucesso.`
      });
      setHistory(fiscalIntegrationService.getHistory(activeScope));
    }, 1000);
  };

  const handleQueryNextNum = () => {
    if (!activeScope) {
      return;
    }

    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      const nextRps = String(Number(config.ultimoNumeroRps) + 1);
      const nextNfse = String(Number(config.ultimoNumeroNfse) + 1);

      setConfig((prev) => ({
        ...prev,
        proximoNumeroRps: nextRps,
      }));

      alert(`Consulta de numeração concluída. Próximo RPS disponível: ${nextRps}. Próxima NFS-e: ${nextNfse}`);

      fiscalIntegrationService.addHistoryItem(activeScope, {
        operacao: 'Consulta',
        numeroNfse: '-',
        protocolo: `SEQ-${Date.now().toString().slice(-6)}`,
        status: 'Sucesso',
        usuario: 'Administrador',
        mensagemPrefeitura: `Sequenciador de lotes atualizado. Próximo RPS: ${nextRps}`
      });
      setHistory(fiscalIntegrationService.getHistory(activeScope));
    }, 1000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const simulateCertUpload = (fileName: string) => {
    if (!activeContext) {
      return;
    }

    const companyName = activeContext.companyName;
    const cnpj = activeContext.companyId || '12.345.678/0001-00';
    const issueDate = new Date().toISOString().split('T')[0];
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    setConfig((prev) => ({
      ...prev,
      certificadoNome: fileName,
      certificadoEmpresa: companyName,
      certificadoCNPJ: cnpj,
      certificadoEmitidoEm: issueDate,
      certificadoValidade: expiryDate.toISOString().split('T')[0],
      certificadoDiasRestantes: 365,
    }));

    fiscalIntegrationService.addHistoryItem(activeContext, {
      operacao: 'Sincronização',
      numeroNfse: '-',
      protocolo: 'CERT-UP',
      status: 'Sucesso',
      usuario: 'Administrador',
      mensagemPrefeitura: `Certificado digital "${fileName}" importado com sucesso para armazenamento criptografado.`
    });
    setHistory(fiscalIntegrationService.getHistory(activeContext));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      simulateCertUpload(file.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      simulateCertUpload(e.target.files[0].name);
    }
  };

  const getCertBadge = (days: number) => {
    if (days <= 0) {
      return <span className="table-badge badge-orange">Expirado</span>;
    }

    if (days < 30) {
      return <span className="table-badge badge-orange">Expira em breve ({days} dias)</span>;
    }

    return <span className="table-badge badge-green">Válido ({days} dias)</span>;
  };

  const handleOpenDraftContext = () => {
    if (!selectedCompanyId || !selectedUf || !selectedMunicipio) {
      return;
    }

    setIsLoadingSelection(true);
    setLoadError(null);

    setTimeout(() => {
      try {
        loadDraftContext();
      } catch (error) {
        console.error('Erro ao abrir contexto de integração:', error);
        setLoadError('Não foi possível abrir esse contexto de emissão.');
      } finally {
        setIsLoadingSelection(false);
      }
    }, 250);
  };

  const handleToggleContextStatus = () => {
    if (!activeContext) {
      return;
    }

    const updated = fiscalIntegrationService.setContextActive(
      activeContext.key,
      !activeContext.isActive,
    );

    if (updated) {
      setActiveContext(updated.context);
    }
  };

  const filteredHistory = useMemo(() => history.filter((item) => {
    if (filterPeriodoInicio && item.data < filterPeriodoInicio) return false;
    if (filterPeriodoFim && item.data > filterPeriodoFim) return false;
    if (filterStatus !== 'Todos' && item.status !== filterStatus) return false;
    if (filterOperacao !== 'Todos' && item.operacao !== filterOperacao) return false;
    if (filterNotaNum && !item.numeroNfse.includes(filterNotaNum)) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchText = `${item.usuario} ${item.mensagemPrefeitura} ${item.protocolo} ${item.operacao}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
  }), [filterNotaNum, filterOperacao, filterPeriodoFim, filterPeriodoInicio, filterStatus, history, searchQuery]);

  const ambienteLabel = config.ambiente === 'producao' ? 'Produção' : 'Homologação';
  const ambienteConfig = activePrefeituraProfile?.ambientes?.[config.ambiente];

  return (
    <div className="submodule-content-card animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Integração Fiscal (NFS-e)</h2>
          <p>
            Defina aqui o contexto de emissão da NFS-e: empresa emitente (contabilidade) + município.
          </p>
        </div>
        {(activeTab === 'ambiente' || activeTab === 'certificado' || activeTab === 'rps') && (
          <button
            onClick={() => handleSaveConfig()}
            disabled={saving}
            className="btn-save-settings"
          >
            {saving ? 'Gravando...' : 'Salvar Configurações'}
          </button>
        )}
      </div>

      <div className="fiscal-context-status-row">
        <span className={`table-badge ${activeContext?.isActive ? 'badge-green' : 'badge-orange'}`}>
          {activeContext?.isActive ? 'Integração Ativa' : 'Integração Inativa'}
        </span>
        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
          {activeContext
            ? `${activeContext.companyName} • ${activeContext.uf}/${activeContext.municipio}`
            : 'Selecione um contexto de emissão'}
        </div>
        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
          {activePrefeituraProfile
            ? `Provedor: ${activePrefeituraProfile.providerLabel} • ${ambienteLabel} URL: ${ambienteConfig?.url || 'Não informado'}`
            : 'Município sem perfil pré-cadastrado.'}
        </div>
        {activeContext && (
          <button
            type="button"
            onClick={handleToggleContextStatus}
            className="btn-add-user"
            style={{ padding: '7px 12px', fontSize: '0.76rem' }}
          >
            <RefreshCw size={12} />
            {activeContext?.isActive ? 'Desativar integração' : 'Ativar integração'}
          </button>
        )}
      </div>

      {saveSuccess && (
          <div className="success-banner animate-fade-in">
            Configurações gravadas para o contexto selecionado.
          </div>
      )}

      {syncResult && (
        <div className="success-banner animate-fade-in" style={{ backgroundColor: 'rgba(197, 146, 53, 0.08)', borderColor: 'var(--color-gold-primary)', color: 'var(--color-gold-dark)' }}>
          {syncResult}
        </div>
      )}

      {loadError && (
        <div className="error-banner animate-fade-in">
          {loadError}
        </div>
      )}

      <div className="fiscal-tabs-nav">
        <button
          onClick={() => setActiveTab('resumo')}
          className={`fiscal-tab-btn ${activeTab === 'resumo' ? 'active' : ''}`}
        >
          Resumo Geral
        </button>
        <button
          onClick={() => setActiveTab('ambiente')}
          className={`fiscal-tab-btn ${activeTab === 'ambiente' ? 'active' : ''}`}
        >
          Ambiente & Provedor
        </button>
        <button
          onClick={() => setActiveTab('certificado')}
          className={`fiscal-tab-btn ${activeTab === 'certificado' ? 'active' : ''}`}
        >
          Certificado Digital A1
        </button>
        <button
          onClick={() => setActiveTab('rps')}
          className={`fiscal-tab-btn ${activeTab === 'rps' ? 'active' : ''}`}
        >
          Configurações do RPS
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`fiscal-tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
        >
          Histórico de Operações
        </button>
        <button
          onClick={() => setActiveTab('contexto')}
          className={`fiscal-tab-btn ${activeTab === 'contexto' ? 'active' : ''}`}
        >
          Contexto de Emissão
        </button>
      </div>

      <div className="tab-content animate-fade-in">
        {activeTab === 'contexto' && (
          <div className="fiscal-integration-layout">
            <div className="fiscal-integration-sidebar">
              <FiscalLocationDirectory
                activeContextKey={activeContext?.key || ''}
                groups={locationTree}
                onSelectContext={openContext}
              />
            </div>

            <div className="fiscal-integration-main">
        <div className="fiscal-location-form-wrapper">
                <div className="form-divider-title">Contexto de Emissão</div>
                <FiscalLocationForm
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  selectedUf={selectedUf}
                  selectedMunicipio={selectedMunicipio}
                  selectedProfile={selectedPrefeituraProfile}
                  loading={isLoadingSelection}
                  onOpenIntegration={handleOpenDraftContext}
                />
              </div>

              <FiscalConnectionPlaceholder />
            </div>
          </div>
        )}

        {activeTab === 'resumo' && (
          <FiscalResumo
            config={config}
            stats={stats}
            history={history}
            syncing={syncing}
            testingConnection={testingConnection}
            testingCert={testingCert}
            connectionResult={connectionResult}
            certResult={certResult}
            onTestConnection={handleTestConnection}
            onTestCert={handleTestCert}
            onSyncData={handleSyncData}
            onQueryLastNfse={handleQueryLastNfse}
            onQueryNextNum={handleQueryNextNum}
            onSwitchTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'ambiente' && (
          <FiscalAmbiente
            config={config}
            setConfig={setConfig}
            prefeituraProfile={activePrefeituraProfile}
            testingConnection={testingConnection}
            connectionResult={connectionResult}
            onTestConnection={handleTestConnection}
          />
        )}

        {activeTab === 'certificado' && (
          <FiscalCertificado
            config={config}
            setConfig={setConfig}
            dragActive={dragActive}
            testingCert={testingCert}
            certResult={certResult}
            showCertModal={showCertModal}
            setShowCertModal={setShowCertModal}
            onTestCert={handleTestCert}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
            getCertBadge={getCertBadge}
          />
        )}

        {activeTab === 'rps' && (
          <FiscalRps
            config={config}
            setConfig={setConfig}
            saving={saving}
            onSaveConfig={handleSaveConfig}
          />
        )}

        {activeTab === 'historico' && (
          <FiscalHistory
            filteredHistory={filteredHistory}
            filterPeriodoInicio={filterPeriodoInicio}
            setFilterPeriodoInicio={setFilterPeriodoInicio}
            filterPeriodoFim={filterPeriodoFim}
            setFilterPeriodoFim={setFilterPeriodoFim}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterOperacao={filterOperacao}
            setFilterOperacao={setFilterOperacao}
            filterNotaNum={filterNotaNum}
            setFilterNotaNum={setFilterNotaNum}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
      </div>
    </div>
  );
};
