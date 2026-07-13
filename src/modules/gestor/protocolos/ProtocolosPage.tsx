import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  FileSearch,
  FolderOpen,
  Loader2,
  Link,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useProtocolos } from './hooks/useProtocolos';
import { useProtocolosRealtime } from './hooks/useProtocolosRealtime';
import { ProtocoloArquivosList } from './components/ProtocoloArquivosList';
import { ProtocoloEmpresaCard } from './components/ProtocoloEmpresaCard';
import type { EmpresaProtocolosGrupo } from './hooks/useProtocolos';
import type { ProtocoloEntrega, ProtocoloUpdate } from './services/protocolosService';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import type { NavigationContext } from '../shared/operationalTypes';
import './Protocolos.css';

const tabLabels = {
  pendentes: 'Pendentes',
  concluidos: 'Concluídos',
  todos: 'Todos',
};

const defaultRegimeOrder = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional', 'MEI', 'PF', 'Isenta'];

const formatCompetencia = (competencia: string) => {
  const [year, month] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

const formatDate = (value: string) => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const sortRegimeEntries = (grouped: Record<string, EmpresaProtocolosGrupo[]>) => {
  return Object.entries(grouped).sort(([regimeA], [regimeB]) => {
    const orderA = defaultRegimeOrder.indexOf(regimeA);
    const orderB = defaultRegimeOrder.indexOf(regimeB);
    if (orderA === -1 && orderB === -1) {
      return regimeA.localeCompare(regimeB);
    }
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
};

const sortByDate = (companyGroups: EmpresaProtocolosGrupo[]) => (
  [...companyGroups].sort((a, b) => b.competencia.localeCompare(a.competencia) || a.empresaNome.localeCompare(b.empresaNome))
);

const formatCompetenciaAtividade = (competencia: string) => {
  const [year, month] = competencia.split('-');
  if (!year || !month) return '';
  return `${month}/${year}`;
};

export const ProtocolosPage: React.FC = () => {
  useProtocolosRealtime(true);
  
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const {
    companyGroups,
    counters,
    isLoading,
    activeTab,
    setActiveTab,
    activeEmpresaTab,
    setActiveEmpresaTab,
    searchTerm,
    setSearchTerm,
    dataInicial,
    setDataInicial,
    dataFinal,
    setDataFinal,
    protocolos,
    updateProtocolo,
  } = useProtocolos();

  const selectedGroupItems = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = companyGroups.find((item) => item.groupId === selectedGroupId);
    if (!group) {
      const [empresaId, competencia] = selectedGroupId.split('::');
      return protocolos.filter((item) => item.empresaId === empresaId && item.competencia === competencia);
    }
    return protocolos.filter((item) => item.empresaId === group.empresaId && item.competencia === group.competencia);
  }, [companyGroups, protocolos, selectedGroupId]);

  const selectedCompany = selectedGroupItems[0] || null;

  const selectedDetailItems = useMemo(() => {
    if (!selectedGroupId) return [];
    const term = searchTerm.trim().toLowerCase();
    return selectedGroupItems.filter((item) => {
      const matchesSearch = !term ||
        item.empresaNome.toLowerCase().includes(term) ||
        item.empresaCnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
        item.entregaNome.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term);
      const matchesInitial = !dataInicial || item.prazo >= dataInicial;
      const matchesFinal = !dataFinal || item.prazo <= dataFinal;
      return matchesSearch && matchesInitial && matchesFinal;
    });
  }, [dataFinal, dataInicial, searchTerm, selectedGroupId, selectedGroupItems]);

  const groupedCompanyGroups = useMemo(() => (
    companyGroups.reduce<Record<string, EmpresaProtocolosGrupo[]>>((acc, group) => {
      acc[group.empresaTipo] = [...(acc[group.empresaTipo] || []), group];
      return acc;
    }, {})
  ), [companyGroups]);

  const sortedGroupEntries = useMemo(() => sortRegimeEntries(groupedCompanyGroups), [groupedCompanyGroups]);

  const empresaTabs = useMemo(() => ([
    { key: 'ativas' as const, label: 'Ativas', count: counters.ativos },
    { key: 'inativas' as const, label: 'Inativas', count: counters.inativos },
    { key: 'todas' as const, label: 'Todas', count: counters.todos },
  ]), [counters]);

  return (
    <div className="protocolos-page animate-fade-in">
      <div className="protocolos-page-header">
        <div>
          <h1>Protocolos e Documentos</h1>
          <p>Controle por empresa e competência do que foi recebido, enviado, protocolado e comprovado.</p>
        </div>
        <div className="protocolos-header-metric">
          <FileCheck size={18} />
          <span>{counters.todos} entregas monitoradas</span>
        </div>
      </div>

      <div className="protocolos-controls">
        <div className="protocolos-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por empresa, CNPJ, entrega ou categoria..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <label className="protocolos-date-filter">
          <CalendarDays size={15} />
          <span>Inicial</span>
          <input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
        </label>

        <label className="protocolos-date-filter">
          <CalendarDays size={15} />
          <span>Final</span>
          <input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
        </label>
      </div>

      {!selectedGroupId && (
        <section className="protocolos-filter-bar">
          <div className="protocolos-filter-block">
            <span className="protocolos-filter-title">Status da empresa</span>
            <div className="protocolos-tabs protocolos-tabs-status">
              {empresaTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`protocolo-tab ${activeEmpresaTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveEmpresaTab(tab.key)}
                >
                  <Clock size={15} />
                  {tab.label}
                  <strong>{tab.count}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="protocolos-filter-block">
            <span className="protocolos-filter-title">Situação do item</span>
            <div className="protocolos-tabs">
              {(['pendentes', 'concluidos', 'todos'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`protocolo-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'pendentes' && <Clock size={15} />}
                  {tab === 'concluidos' && <CheckCircle2 size={15} />}
                  {tab === 'todos' && <FileSearch size={15} />}
                  {tabLabels[tab]}
                  <strong>{counters[tab]}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="protocolos-loading">
          <Loader2 size={34} className="animate-spin" />
          <span>Carregando protocolos...</span>
        </div>
      ) : selectedGroupId && selectedCompany ? (
        <EmpresaProtocolosDetail
          company={selectedCompany}
          items={selectedDetailItems}
          allCompanyItems={selectedGroupItems}
          onBack={() => setSelectedGroupId(null)}
          updateProtocolo={updateProtocolo}
        />
      ) : companyGroups.length === 0 ? (
        <div className="protocolos-empty">
          <FileSearch size={38} />
          <h3>Nenhuma empresa encontrada</h3>
          <p>Ajuste os filtros ou selecione a aba Ativas.</p>
        </div>
      ) : (
        <div className="protocolos-regime-groups animate-fade-in">
          {sortedGroupEntries.map(([regime, groups]) => {
            const groupsInRegime = sortByDate(groups);
            return (
              <section key={regime} className="protocolos-regime-section">
                <h2 className="protocolos-regime-title">
                  {regime}
                  <span>{groupsInRegime.length} {groupsInRegime.length === 1 ? 'competência' : 'competências'}</span>
                </h2>
                <div className="protocolos-company-grid">
                  {groupsInRegime.map((group) => (
                    <ProtocoloEmpresaCard key={group.groupId} group={group} onOpen={() => setSelectedGroupId(group.groupId)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface DetailProps {
  company: ProtocoloEntrega;
  items: ProtocoloEntrega[];
  allCompanyItems: ProtocoloEntrega[];
  onBack: () => void;
  updateProtocolo: (id: string, updates: ProtocoloUpdate) => void;
}

const EmpresaProtocolosDetail: React.FC<DetailProps> = ({
  company,
  items,
  allCompanyItems,
  onBack,
  updateProtocolo,
}) => {
  const { openTab } = useInternalTabs();

  const handleOpenAtividades = () => {
    const navigationContext: NavigationContext = {
      sourceModule: 'protocolos',
      companyId: company.empresaId,
      competencia: formatCompetenciaAtividade(company.competencia),
      returnTo: 'protocolos',
    };

    openTab(
      'atividades-fechamentos',
      'Fechamentos de Clientes',
      'Building2',
      {
        titleSuffix: company.empresaNome,
        data: {
          ...navigationContext,
          selectedCompanyId: company.empresaId,
          selectedCompetencia: formatCompetenciaAtividade(company.competencia),
        },
      },
    );
  };

  const handleOpenConformidade = () => {
    const navigationContext: NavigationContext = {
      sourceModule: 'protocolos',
      companyId: company.empresaId,
      competencia: formatCompetenciaAtividade(company.competencia),
      returnTo: 'protocolos',
    };

    openTab(
      'conformidade',
      'Conformidade',
      'ShieldCheck',
      {
        titleSuffix: company.empresaNome,
        data: {
          ...navigationContext,
          selectedCompanyId: company.empresaId,
        },
      },
    );
  };

  return (
    <div className="protocolo-company-detail">
      <div className="protocolos-breadcrumb">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Empresas
        </button>
        <span>/</span>
        <strong>{company.empresaNome}</strong>
        <span>/</span>
        <strong>{formatCompetencia(company.competencia)}</strong>
      </div>

      <section className="protocolo-detail-header">
        <div className="protocolo-detail-company">
          <span className="protocolo-company-logo">
            {company.empresaLogo ? (
              <img src={company.empresaLogo} alt={`Logo ${company.empresaNome}`} />
            ) : (
              <span>{getInitials(company.empresaNome)}</span>
            )}
          </span>
          <div>
            <h2>{company.empresaNome}</h2>
            <p>
              {company.empresaCnpj} • {company.empresaTipo} • {company.empresaTipoEstabelecimento} • {company.empresaEmail}
            </p>
          </div>
        </div>

        <div className="protocolo-detail-kpis">
          <span>{formatCompetencia(company.competencia)}</span>
          <span>{allCompanyItems.length} registros</span>
          <span>{allCompanyItems.filter((item) => item.status === 'Pendente').length} pendentes</span>
          <span>{allCompanyItems.filter((item) => item.status === 'Concluído').length} concluídos</span>
        </div>
      </section>

      <section className="protocolo-company-deliveries">
        <div className="protocolo-section-title">
          <FolderOpen size={17} />
          <div>
            <h3>Evidências da competência {formatCompetencia(company.competencia)}</h3>
            <p>Arquivos, recibos, envios, recebimentos e provas vinculadas à operação.</p>
          </div>
          <button type="button" className="protocolos-open-atividades" onClick={handleOpenAtividades}>
            <Link size={14} /> Abrir atividades
          </button>
          <button type="button" className="protocolos-open-atividades" onClick={handleOpenConformidade}>
            <ShieldCheck size={14} /> Abrir conformidade
          </button>
        </div>

        {items.length === 0 ? (
          <div className="protocolos-empty compact">
            <FileSearch size={28} />
            <p>Nenhum registro desta empresa nos filtros atuais.</p>
          </div>
        ) : (
          <ProtocoloArquivosList
            items={items}
            formatDate={formatDate}
            onUpdateProtocolo={updateProtocolo}
          />
        )}
      </section>
    </div>
  );
};
