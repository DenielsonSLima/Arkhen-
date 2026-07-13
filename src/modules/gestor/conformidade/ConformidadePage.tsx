import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
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
import type { ConformidadeTipo } from './services/conformidadeService';
import './ConformidadePage.css';

interface ConformidadePageProps {
  initialCompanyId?: string;
}

const TIME_WINDOW_OPTIONS = [
  { value: 'hoje' as const, label: 'Hoje' },
  { value: 'semana' as const, label: 'Essa semana' },
  { value: 'atrasados' as const, label: 'Atrasados' },
] as const;

const TYPE_OPTIONS: Array<{ id: ConformidadeTipo; label: string }> = [
  { id: 'fiscal', label: 'Fiscal' },
  { id: 'folha', label: 'Folha' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'protocolo', label: 'Protocolo' },
  { id: 'atendimento', label: 'Atendimento' },
];

const PRIORITY_LABEL: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'Verde',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
};

const PRIORITY_CLASS: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'prioridade-verde',
  amarelo: 'prioridade-amarelo',
  vermelho: 'prioridade-vermelho',
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
};

const formatCompetencia = (competencia: string) => {
  const [year, month] = competencia.split('-');
  if (!year || !month) return '-';
  return `${month}/${year}`;
};

const getDaysTo = (dueDate: string, ref = new Date()) => {
  const due = new Date(`${dueDate}T00:00:00`);
  const base = new Date(ref.toISOString().slice(0, 10));
  return Math.floor((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
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
    searchTerm,
    isLoading,
    obrSorted,
    metricas,
    referenceSteps,
    setTimeWindow,
    setTipoFiltro,
    setResponsavelFiltro,
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

  return (
    <div className="conformidade-page animate-fade-in">
      <header className="conformidade-page-header">
        <div>
          <h1>Conformidade</h1>
          <p>Painel derivado de riscos, atrasos, SLA e gargalos calculados sobre atividades, protocolos e prazos.</p>
        </div>
        <div className="conformidade-page-kpi">
          <ShieldCheck size={18} />
          <span>{metricas.total} riscos monitorados</span>
        </div>
      </header>

      <section className="conformidade-toolbar">
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
            {TYPE_OPTIONS.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`conformidade-tab tipo ${tipoFiltro === type.id ? 'active' : ''}`}
                onClick={() => setTipoFiltro(type.id)}
              >
                {type.label}
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
          <p>Taxa de entrega no prazo</p>
          <strong>{metricas.taxaPrazo}%</strong>
        </div>
        <div className="conformidade-metric-card">
          <p>Em andamento</p>
          <strong>{metricas.andamento}</strong>
        </div>
        <div className="conformidade-metric-card">
          <p>Concluídas</p>
          <strong>{metricas.concluidas}</strong>
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
          <p>Ajuste janela, tipo ou termo de busca.</p>
        </div>
      ) : (
        <section className="conformidade-obrigacoes-list">
          {obrSorted.map((item) => {
            const diasParaVencimento = getDaysTo(item.vencimento);
            const isVencido = diasParaVencimento < 0;
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
                    <span className={`conformidade-badge tipo ${item.tipo}`}>{item.tipo}</span>
                    <span className={`conformidade-badge status ${getStatusClass(item.status)}`}>{item.status}</span>
                    <span className={`conformidade-badge prioridade ${PRIORITY_CLASS[item.prioridade]}`}>
                      Prioridade {PRIORITY_LABEL[item.prioridade]}
                    </span>
                  </div>
                </header>

                <div className="conformidade-obrigacao-meta">
                  <span><FileText size={14} />{item.descricao}</span>
                  <span><User size={14} />Responsável: {item.responsavel}</span>
                  <span><CalendarDays size={14} />Vencimento: {dataVenc}</span>
                  <span>
                    <AlertTriangle size={14} />
                    {isVencido ? `${item.atrasoDias} dia(s) em atraso` : `Vence em ${diasParaVencimento} dia(s)`}
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
                    <div className="conformidade-regra-box" style={{ marginTop: '12px' }}>
                      <p>Contrato: entrega em até {item.regraContrato.prazoDias} dias</p>
                      <p>Impacto: {item.regraContrato.impacto}/5</p>
                      <p>Consequência: {item.regraContrato.consequencia}</p>
                    </div>

                    <div className="conformidade-checklist">
                      <h4>Checklist de competência</h4>
                      <div className="conformidade-checklist-steps">
                        {referenceSteps.map((step, stepIndex) => {
                          const stepState = item.etapas.find((itemStep) => itemStep.id === step.id);
                          const isCompleted = !!stepState?.concluida;
                          const isLocked = stepIndex > 0 && !item.etapas[stepIndex - 1]?.concluida;

                          return (
                            <label
                              key={`${item.id}-${step.id}`}
                              className={`conformidade-step-row ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                disabled={isLocked}
                                onChange={(event) => handleToggleStep(item.id, step.id, event.target.checked)}
                              />
                              <div>
                                <strong>{step.label}</strong>
                                <span>
                                  {isCompleted && stepState?.responsavel
                                    ? `Concluído por ${stepState.responsavel}${stepState.concluidaEm ? ` • ${formatDate(stepState.concluidaEm.slice(0, 10))}` : ''}`
                                    : isLocked ? 'Bloqueado até etapa anterior concluir' : 'Pendente'}
                                </span>
                              </div>
                              {isCompleted ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="conformidade-documentos">
                      <h4>Canal de controle de documentos</h4>
                      {item.documentosPendentes.length === 0 && <p>Nenhuma pendência documental cadastrada.</p>}
                      {item.documentosPendentes.length > 0 && (
                        <ul>
                          {item.documentosPendentes.map((doc) => (
                            <li key={doc.id}>
                              <span>{doc.nome}</span>
                              <span className="faltando-desde">em falta desde {formatDate(doc.faltaDesde)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
