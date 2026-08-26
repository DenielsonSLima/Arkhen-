import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Clock,
  FileText,
  ListChecks,
  Search,
  ShieldCheck,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useConformidade } from './hooks/useConformidade';
import { useConformidadeRealtime } from './hooks/useConformidadeRealtime';
import type { ConformidadeTipo } from './services/conformidadeOperationalService';
import { ConformidadeChecklist } from './components/ConformidadeChecklist';
import './ConformidadePage.css';
import './ConformidadeDetails.css';

interface ConformidadePageProps {
  initialCompanyId?: string;
}

const TIME_WINDOW_OPTIONS = [
  { value: 'todos' as const, label: 'Todos' },
  { value: 'hoje' as const, label: 'Hoje' },
  { value: 'semana' as const, label: 'Essa semana' },
  { value: 'atrasados' as const, label: 'Atrasados' },
  { value: 'sem-prazo' as const, label: 'Sem prazo' },
] as const;

const TYPE_LABEL: Record<ConformidadeTipo, string> = {
  fiscal: 'Fiscal',
  folha: 'Folha',
  contabil: 'Contábil',
  atendimento: 'Atendimento',
  atividade: 'Atividade',
};

const PRIORITY_LABEL: Record<'verde' | 'amarelo' | 'vermelho' | 'sem-prazo', string> = {
  verde: 'Verde',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
  'sem-prazo': 'Sem prazo',
};

const PRIORITY_CLASS: Record<'verde' | 'amarelo' | 'vermelho' | 'sem-prazo', string> = {
  verde: 'prioridade-verde',
  amarelo: 'prioridade-amarelo',
  vermelho: 'prioridade-vermelho',
  'sem-prazo': 'prioridade-sem-prazo',
};

const formatDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
};

const formatCompetencia = (competencia: string) => {
  const [year, month] = competencia.split('-');
  if (!year || !month) return '-';
  return `${month}/${year}`;
};

const getStatusClass = (status: string) => {
  if (status === 'Pendente') return 'pendente';
  if (status === 'Concluído') return 'concluido';
  return 'em-andamento';
};

export const ConformidadePage: React.FC<ConformidadePageProps> = ({ initialCompanyId }) => {
  useConformidadeRealtime(true);
  const {
    timeWindow,
    tipoFiltro,
    responsavelFiltro,
    competencia,
    searchTerm,
    isLoading,
    errorMessage,
    updateErrorMessage,
    isUpdating,
    obrSorted,
    totalDisponivel,
    solicitacoesDocumentaisVisiveis,
    metricas,
    typeOptions,
    setTimeWindow,
    setTipoFiltro,
    setResponsavelFiltro,
    setCompetencia,
    setSearchTerm,
    handleToggleStep,
    responsavelOptions,
  } = useConformidade({ initialCompanyId });

  const delayByResponsavel = useMemo(() => metricas.atrasadasPorResponsavel, [metricas.atrasadasPorResponsavel]);
  const delayByCliente = useMemo(() => metricas.atrasadasPorCliente, [metricas.atrasadasPorCliente]);
  const delayByRotina = useMemo(() => metricas.atrasadasPorRotina, [metricas.atrasadasPorRotina]);

  const [expandedCards, setExpandedCards] = React.useState<Record<string, boolean>>({});

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  if (isLoading) {
    return (
      <div className="conformidade-page">
        <div className="conformidade-loading">Carregando painel de conformidade...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="conformidade-page">
        <div className="conformidade-empty" role="alert">
          <AlertCircle size={28} />
          <h3>Não foi possível carregar a conformidade</h3>
          <p>{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conformidade-page animate-fade-in">
      <header className="conformidade-page-header">
        <div>
          <h1>Conformidade</h1>
          <p>Painel baseado nas atividades e solicitações documentais que seu perfil pode consultar.</p>
        </div>
        <div className="conformidade-page-kpi">
          <ShieldCheck size={18} />
          <span>{metricas.total} itens visíveis monitorados</span>
        </div>
      </header>

      {!solicitacoesDocumentaisVisiveis && (
        <div className="conformidade-data-scope" role="status">
          <AlertTriangle size={18} />
          <span>
            Este painel mostra somente atividades. Solicitações documentais não estão incluídas
            porque seu perfil não possui acesso ao módulo Documentos.
          </span>
        </div>
      )}

      {updateErrorMessage && (
        <div className="conformidade-data-scope" role="alert">
          <AlertCircle size={18} />
          <span>{updateErrorMessage}</span>
        </div>
      )}

      <section className="conformidade-toolbar">
        <div className="conformidade-tab-block">
          <label className="conformidade-tab-title" htmlFor="conformidade-competencia">
            Competência
          </label>
          <input
            id="conformidade-competencia"
            type="month"
            value={competencia}
            onChange={(event) => setCompetencia(event.target.value)}
          />
        </div>
        <div className="conformidade-tab-block">
          <span className="conformidade-tab-title">Janela</span>
          <div className="conformidade-tabs">
            {TIME_WINDOW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`conformidade-tab ${timeWindow === option.value ? 'active' : ''}`}
                onClick={() => setTimeWindow(option.value)}
              >
                <Clock size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="conformidade-tab-block">
          <span className="conformidade-tab-title">Tipos de pendência</span>
          <div className="conformidade-tabs">
            <button
              type="button"
              className={`conformidade-tab tipo ${tipoFiltro === 'todos' ? 'active' : ''}`}
              onClick={() => setTipoFiltro('todos')}
            >
              Todos
            </button>
            {typeOptions.map((type) => (
              <button
                key={type}
                type="button"
                className={`conformidade-tab tipo ${tipoFiltro === type ? 'active' : ''}`}
                onClick={() => setTipoFiltro(type)}
              >
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="conformidade-tab-block">
          <span className="conformidade-tab-title">Responsável</span>
          <label className="conformidade-select">
            <select
              value={responsavelFiltro}
              onChange={(event) => setResponsavelFiltro(event.target.value)}
            >
              <option value="todos">Todos</option>
              {responsavelOptions.map((responsavel) => (
                <option key={responsavel} value={responsavel}>
                  {responsavel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="conformidade-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por cliente, responsável, rotina ou CNPJ..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </section>

      <section className="conformidade-metrics-grid">
        <div className="conformidade-metric-card">
          <p>Com prazo definido</p>
          <strong>{metricas.comPrazoDefinido}</strong>
        </div>
        <div className="conformidade-metric-card">
          <p>Sem prazo configurado</p>
          <strong>{metricas.semPrazo}</strong>
        </div>
        <div className="conformidade-metric-card">
          <p>Em andamento</p>
          <strong>{metricas.andamento}</strong>
        </div>
        <div className="conformidade-metric-card">
          <p>Atrasadas</p>
          <strong>{metricas.atrasadas}</strong>
        </div>
      </section>

      <section className="conformidade-delay-grid">
        <div className="conformidade-delay-panel">
          <h3><User size={14} /> Atraso por responsável</h3>
          <ul>
            {delayByResponsavel.length === 0 && <li>Nenhum atraso no recorte atual.</li>}
            {delayByResponsavel.map((item) => (
              <li key={`resp-${item.label}`}>
                <span>{item.label}</span>
                <strong>{item.quantidade}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="conformidade-delay-panel">
          <h3><User size={14} /> Atraso por cliente</h3>
          <ul>
            {delayByCliente.length === 0 && <li>Nenhum atraso no recorte atual.</li>}
            {delayByCliente.map((item) => (
              <li key={`cli-${item.label}`}>
                <span>{item.label}</span>
                <strong>{item.quantidade}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="conformidade-delay-panel">
          <h3><ListChecks size={14} /> Atraso por rotina</h3>
          <ul>
            {delayByRotina.length === 0 && <li>Nenhum atraso no recorte atual.</li>}
            {delayByRotina.map((item) => (
              <li key={`rot-${item.label}`}>
                <span>{item.label}</span>
                <strong>{item.quantidade}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {obrSorted.length === 0 ? (
        <div className="conformidade-empty">
          <AlertCircle size={28} />
          <h3>Nenhuma obrigação no recorte selecionado</h3>
          <p>
            {totalDisponivel === 0
              ? solicitacoesDocumentaisVisiveis
                ? 'Nenhuma atividade ou solicitação documental aberta foi encontrada. Configure rotinas ou crie solicitações em Documentos para acompanhar a conformidade.'
                : 'Nenhuma atividade aberta foi encontrada. Solicitações documentais não foram consultadas por falta de permissão no módulo Documentos.'
              : 'Ajuste janela, tipo ou termo de busca.'}
          </p>
        </div>
      ) : (
        <section className="conformidade-obrigacoes-list">
          {obrSorted.map((item) => {
            const diasParaVencimento = item.diasParaVencimento;
            const isVencido = item.atrasoDias > 0;
            const dataVenc = formatDate(item.vencimento);
            const isExpanded = !!expandedCards[item.id];

            return (
              <article key={item.id} className={`conformidade-obrigacao-card ${PRIORITY_CLASS[item.prioridade]}`}>
                <header className="conformidade-obrigacao-header">
                  <div>
                    <h3>{item.rotina}</h3>
                    <p>
                      {item.clienteNome} • {item.cnpj} • {formatCompetencia(item.competencia)}
                    </p>
                  </div>
                  <div className="conformidade-obrigacao-chips">
                    <span className={`conformidade-badge tipo ${item.tipo}`}>{TYPE_LABEL[item.tipo]}</span>
                    <span className={`conformidade-badge status ${getStatusClass(item.status)}`}>{item.status}</span>
                    <span className={`conformidade-badge prioridade ${PRIORITY_CLASS[item.prioridade]}`}>
                      Prioridade {PRIORITY_LABEL[item.prioridade]}
                    </span>
                  </div>
                </header>

                <div className="conformidade-obrigacao-meta">
                  {item.descricao ? <span><FileText size={14} />{item.descricao}</span> : null}
                  <span><User size={14} />Responsável: {item.responsavel || 'Não atribuído'}</span>
                  <span><CalendarDays size={14} />Vencimento: {item.vencimento ? dataVenc : 'Não definido'}</span>
                  <span><CalendarDays size={14} />Prazo interno: {item.prazoInterno ? formatDate(item.prazoInterno) : 'Não definido'}</span>
                  <span><ShieldCheck size={14} />Revisão: {item.revisaoStatus}</span>
                  <span>
                    <AlertTriangle size={14} />
                    {diasParaVencimento === null
                      ? 'Prazo pendente de configuração'
                      : isVencido
                        ? `${item.atrasoDias} dia(s) em atraso`
                        : `Vence em ${diasParaVencimento} dia(s)`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => toggleCard(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-gold-dark, #c59235)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'background 0.2s',
                    }}
                  >
                    {isExpanded ? (
                      <>
                        Ocultar Detalhes <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        Ver Detalhes <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <>
                    {item.regraContrato ? (
                      <div className="conformidade-regra-box" style={{ marginTop: '12px' }}>
                        <p>Contrato: entrega em até {item.regraContrato.prazoDias} dias</p>
                        <p>Impacto: {item.regraContrato.impacto}/5</p>
                        <p>Consequência: {item.regraContrato.consequencia}</p>
                      </div>
                    ) : null}

                    {item.etapas.length > 0 && (
                      <ConformidadeChecklist
                        item={item}
                        isUpdating={isUpdating}
                        formatDate={formatDate}
                        onToggle={handleToggleStep}
                      />
                    )}

                    {item.origem === 'solicitacoes-documentos' && (
                      <div className="conformidade-documentos">
                        <h4>Solicitações abertas para o cliente nesta competência</h4>
                        <ul>
                          {item.solicitacoesDocumentos.map((doc) => (
                            <li key={doc.id}>
                              <span>{doc.nome}</span>
                              <span className="faltando-desde">
                                {doc.status}
                                {doc.dataLimite
                                  ? ` • prazo ${formatDate(doc.dataLimite)}`
                                  : ' • sem prazo definido'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};
