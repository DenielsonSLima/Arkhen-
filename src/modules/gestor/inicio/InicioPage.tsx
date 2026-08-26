import React, { useCallback, useMemo } from 'react';
import {
  MessageSquareQuote,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  FileClock,
  ListChecks,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import officeBackground from '../../../assets/office-scene-meeting.png';
import { getEventoOrigemConfig } from '../agenda/services/agenda.service';
import { formatDateBR, todayKey } from '../atividades/services/rotinasAtividadesService';
import { useInicio } from './hooks/useInicio';
import { useInicioBootstrap } from './hooks/useInicioBootstrap';
import { useInicioRealtime } from './hooks/useInicioRealtime';
import { useInicioSetup } from './hooks/useInicioSetup';
import { InicioDataErrorBanner } from './components/InicioDataErrorBanner';
import { PrimeirosPassosCard } from './components/PrimeirosPassosCard';
import { PERIODO_CONFIG } from './services/inicioDashboardSummary';
import { navigateToInicioTarget, type InicioSetupTarget } from './services/inicioNavigation';
import { frasesMotivacionais, type FraseMotivacional } from './services/motivationalPhrases';
import './InicioPage.css';

const getDayOfYear = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
};

const getAlertaTexto = (diasRestantes: number) => {
  if (diasRestantes < 0) return 'Vencido';
  if (diasRestantes === 0) return 'Vence hoje';
  return `Vence em ${diasRestantes} dias`;
};

const quantidade = (total: number, singular: string, plural: string) => (
  `${total} ${total === 1 ? singular : plural}`
);

type InicioPageProps = {
  onInitialReady?: () => void;
};

export const InicioPage: React.FC<InicioPageProps> = ({ onInitialReady }) => {
  useInicioRealtime(true);
  const {
    stats,
    summary,
    isLoading: dashboardLoading,
    dashboardError,
    retryDashboard,
  } = useInicio();
  const setupQuery = useInicioSetup();
  const { activateModule } = useInternalTabs();

  const dataMotivacional = todayKey();
  const hoje = summary.dataReferencia || dataMotivacional;

  const fraseMotivacionalFallback: FraseMotivacional = useMemo(
    () => frasesMotivacionais[
      (getDayOfYear(dataMotivacional) - 1 + frasesMotivacionais.length) % frasesMotivacionais.length
    ],
    [dataMotivacional],
  );
  const { fraseMotivacional } = useInicioBootstrap({
    hoje: dataMotivacional,
    fraseFallback: fraseMotivacionalFallback,
    dashboardReady: !dashboardLoading,
    onReady: onInitialReady,
  });

  const handleSetupNavigate = useCallback((target: InicioSetupTarget) => {
    navigateToInicioTarget(target, activateModule);
  }, [activateModule]);

  const failedSources = dashboardError ? ['resumo operacional'] : [];
  const riskDataUnavailable = dashboardError;

  const handleRetryData = useCallback(() => {
    if (dashboardError) void retryDashboard();
  }, [dashboardError, retryDashboard]);

  if (dashboardLoading) {
    return <div className="inicio-loading">Carregando painel contábil...</div>;
  }

  return (
    <div className="inicio-page">
      <PrimeirosPassosCard
        status={setupQuery.data}
        isLoading={setupQuery.isLoading}
        isError={setupQuery.isError}
        onNavigate={handleSetupNavigate}
        onRetry={() => { void setupQuery.refetch(); }}
      />

      {failedSources.length > 0 && (
        <InicioDataErrorBanner sources={failedSources} onRetry={handleRetryData} />
      )}

      <section className="inicio-metrics-grid" aria-label="Prioridades operacionais">
        <article className={`inicio-metric-card ${!riskDataUnavailable && summary.operacao.atrasosTotal > 0 ? 'is-critical' : ''}`}>
          <div className="inicio-metric-icon orange"><AlertTriangle size={22} /></div>
          <span>Em atraso</span>
          <strong className={riskDataUnavailable ? 'inicio-metric-value-unavailable' : ''}>
            {riskDataUnavailable ? '—' : summary.operacao.atrasosTotal}
          </strong>
          <small>
            {riskDataUnavailable
              ? 'Dados incompletos'
              : quantidade(summary.operacao.pendenciasTotal, 'pendência aberta', 'pendências abertas')}
          </small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon gold"><ListChecks size={22} /></div>
          <span>Vencem hoje</span>
          <strong className={riskDataUnavailable ? 'inicio-metric-value-unavailable' : ''}>
            {riskDataUnavailable ? '—' : summary.operacao.vencemHojeTotal}
          </strong>
          <small>
            {dashboardError
              ? 'Atividades indisponíveis'
              : quantidade(summary.tarefas.atividadesHojeTotal, 'atividade planejada', 'atividades planejadas')}
          </small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon blue"><CalendarRange size={22} /></div>
          <span>Próximos 7 dias</span>
          <strong className={dashboardError ? 'inicio-metric-value-unavailable' : ''}>
            {dashboardError ? '—' : summary.agenda.total}
          </strong>
          <small>
            {dashboardError
              ? 'Agenda indisponível'
              : quantidade(summary.agenda.hojeTotal, 'compromisso hoje', 'compromissos hoje')}
          </small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon green"><Users size={22} /></div>
          <span>Equipe ativa</span>
          <strong className={dashboardError ? 'inicio-metric-value-unavailable' : ''}>
            {dashboardError ? '—' : summary.usuarios.length}
          </strong>
          <small>
            {dashboardError || !stats
              ? 'Clientes indisponíveis'
              : quantidade(stats.clientesAtivos, 'cliente ativo', 'clientes ativos')}
          </small>
        </article>
      </section>

      <section className="inicio-dashboard-grid">
        <article className="inicio-panel inicio-panel-agenda">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Agenda</span>
              <h2>Hoje</h2>
              {!dashboardError && (
                <small className="inicio-panel-header-meta">
                  {quantidade(summary.agenda.hojeTotal, 'compromisso', 'compromissos')}
                </small>
              )}
            </div>
            <Clock3 size={20} />
          </div>

          <div className="inicio-agenda-list">
            {dashboardError ? (
              <div className="inicio-empty-row inicio-empty-row--error">Não foi possível carregar a agenda.</div>
            ) : summary.agenda.hoje.length === 0 ? (
              <div className="inicio-empty-row">Nenhum compromisso para hoje.</div>
            ) : summary.agenda.hoje.map((evento) => {
              const origem = getEventoOrigemConfig(evento);
              return (
                <div className="inicio-agenda-item" key={evento.id}>
                  <span className={`inicio-origin-dot ${origem.className}`} />
                  <div>
                    <strong>{evento.titulo}</strong>
                    <small>{origem.label}{evento.empresaNome ? ` - ${evento.empresaNome}` : ''}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="inicio-panel inicio-panel-week">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Próximos dias</span>
              <h2>Semana operacional</h2>
            </div>
            <CalendarRange size={20} />
          </div>

          <div className="inicio-week-list">
            {dashboardError ? (
              <div className="inicio-empty-row inicio-empty-row--error">
                Não foi possível carregar os próximos compromissos.
              </div>
            ) : summary.agenda.semana.length === 0 ? (
              <div className="inicio-empty-row">Nenhum compromisso nos próximos dias.</div>
            ) : summary.agenda.semana.map((evento) => {
              const origem = getEventoOrigemConfig(evento);
              return (
                <div className="inicio-week-row" key={evento.id}>
                  <div className="inicio-agenda-date">
                    <strong>{new Date(`${evento.data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit' })}</strong>
                    <span>{new Date(`${evento.data}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  </div>
                  <div>
                    <strong>{evento.titulo}</strong>
                    <small>{origem.label}{evento.responsavelNome ? ` - ${evento.responsavelNome}` : ''}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="inicio-panel inicio-panel-pending">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Pendências</span>
              <h2>Prazos e riscos</h2>
              {!riskDataUnavailable && (
                <small className="inicio-panel-header-meta">
                  {quantidade(summary.operacao.pendenciasTotal, 'pendência no total', 'pendências no total')}
                </small>
              )}
            </div>
            <ShieldAlert size={20} />
          </div>

          <div className="inicio-risk-list">
            {riskDataUnavailable && (
              <div className="inicio-empty-row inicio-empty-row--error inicio-empty-row--stacked">
                Não foi possível carregar todos os prazos e riscos.
              </div>
            )}
            {summary.alertas.criticos.map((alerta) => (
              <div className={`inicio-risk-row ${alerta.diasRestantes <= 0 ? 'late' : ''}`} key={alerta.id}>
                {alerta.tipo === 'certificado' ? <ShieldAlert size={17} /> : <FileClock size={17} />}
                <div>
                  <strong>{alerta.nome}</strong>
                  <small>{alerta.empresaNome} - {alerta.dataValidade}</small>
                </div>
                <span>{getAlertaTexto(alerta.diasRestantes)}</span>
              </div>
            ))}
            {summary.tarefas.pendentes.slice(0, 3).map((tarefa) => (
              <div className={`inicio-risk-row ${tarefa.vencimento < hoje ? 'late' : ''}`} key={tarefa.id}>
                <ListChecks size={17} />
                <div>
                  <strong>{tarefa.titulo}</strong>
                  <small>{tarefa.responsavel || 'Sem responsável'} - {tarefa.cliente}</small>
                </div>
                <span>{formatDateBR(tarefa.vencimento)}</span>
              </div>
            ))}
            {!riskDataUnavailable && summary.operacao.pendenciasTotal === 0 && (
              <div className="inicio-empty-row inicio-empty-row--success">
                Nenhum prazo ou validade pendente no momento.
              </div>
            )}
          </div>
        </article>

        <article className="inicio-panel inicio-panel-activity">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Atividades</span>
              <h2>Tarefas com vencimento hoje</h2>
              {!dashboardError && (
                <small className="inicio-panel-header-meta">
                  {quantidade(summary.tarefas.atividadesHojeTotal, 'atividade no total', 'atividades no total')}
                </small>
              )}
            </div>
            <CheckCircle2 size={20} />
          </div>

          <div className="inicio-task-list">
            {dashboardError ? (
              <div className="inicio-empty-row inicio-empty-row--error">Não foi possível carregar as atividades.</div>
            ) : summary.tarefas.atividadesHoje.length === 0 ? (
              <div className="inicio-empty-row">Nenhuma atividade com vencimento hoje.</div>
            ) : summary.tarefas.atividadesHoje.map((tarefa) => (
              <div className="inicio-task-row" key={tarefa.id}>
                <span className={`inicio-status-pill ${tarefa.status === 'Concluída' ? 'done' : tarefa.status === 'Em andamento' ? 'progress' : 'pending'}`}>
                  {tarefa.status}
                </span>
                <div>
                  <strong>{tarefa.titulo}</strong>
                  <small>{tarefa.responsavel || 'Sem responsável'} - {tarefa.frequencia} - {tarefa.cliente}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="inicio-team-panel">
        <div className="inicio-panel-header">
          <div>
            <span className="inicio-kicker">Equipe</span>
            <h2>Andamento por usuário</h2>
          </div>
          <BarChart3 size={20} />
        </div>

        {dashboardError ? (
          <div className="inicio-empty-row inicio-empty-row--error">
            Não foi possível carregar o andamento da equipe.
          </div>
        ) : summary.usuarios.length === 0 ? (
          <div className="inicio-empty-row">Nenhum usuário ativo encontrado para acompanhar.</div>
        ) : (
          <div className="inicio-user-grid">
            {summary.usuarios.map((usuario) => {
              const nomeUsuario = usuario.usuario || 'Usuário sem nome';
              return (
                <article className="inicio-user-card" key={usuario.key}>
                  <div className="inicio-user-head">
                    <div className="inicio-avatar">{nomeUsuario.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{nomeUsuario}</strong>
                      <small>{usuario.done}/{usuario.total} atividades concluídas</small>
                    </div>
                    <span>{usuario.pct}%</span>
                  </div>

                  <div className="inicio-progress-track">
                    <div style={{ width: `${usuario.pct}%` }} />
                  </div>

                  <div className="inicio-period-grid">
                    {PERIODO_CONFIG.map((periodo) => {
                      const data = usuario.periodos[periodo.key];
                      return (
                        <div className="inicio-period-box" key={periodo.key}>
                          <span>{periodo.label}</span>
                          <strong>{data.pct}%</strong>
                          <small>{data.done}/{data.total}</small>
                          <div className="inicio-mini-track">
                            <div style={{ width: `${data.pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {usuario.atrasadas > 0 && (
                    <div className="inicio-user-warning">
                      <AlertTriangle size={14} />
                      {quantidade(usuario.atrasadas, 'atividade atrasada', 'atividades atrasadas')}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="inicio-motivation-card">
        <div
          className="inicio-motivation-card__backdrop"
          style={{ '--inicio-motivation-bg': `url(${officeBackground})` } as React.CSSProperties}
        />
        <div className="inicio-motivation-card__rays" aria-hidden="true" />
        <div className="inicio-motivation-card__grain" aria-hidden="true" />
        <MessageSquareQuote className="inicio-motivation-card__bg-icon" size={150} aria-hidden />
        <div className="inicio-motivation-card__content">
          <p className="inicio-motivation-card__eyebrow">Mensagem inspiradora</p>
          <blockquote>“{fraseMotivacional.texto}”</blockquote>
          <cite>— {fraseMotivacional.autor}</cite>
        </div>
      </section>
    </div>
  );
};
