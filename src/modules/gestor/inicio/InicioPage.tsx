import React, { useMemo } from 'react';
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
  Settings,
} from 'lucide-react';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import officeBackground from '../../../assets/office-scene-meeting.png';
import { getEventoOrigemConfig } from '../agenda/services/agenda.service';
import {
  formatDateBR,
  todayKey,
  type FrequenciaAtividade,
  type TarefaGestor,
} from '../atividades/services/rotinasAtividadesService';
import { useInicio } from './hooks/useInicio';
import { useInicioBootstrap } from './hooks/useInicioBootstrap';
import { useInicioRealtime } from './hooks/useInicioRealtime';
import type { VencimentoAlerta } from './services/inicioService';
import { frasesMotivacionais, type FraseMotivacional } from './services/motivationalPhrases';
import './InicioPage.css';

const alertasPadrao: VencimentoAlerta[] = [];

type PeriodoChave = 'diaria' | 'semanal' | 'mensal';

const periodoConfig: Array<{ key: PeriodoChave; label: string; frequencias: FrequenciaAtividade[] }> = [
  { key: 'diaria', label: 'Diaria', frequencias: ['Diária'] },
  { key: 'semanal', label: 'Semanal', frequencias: ['Semanal', 'Quinzenal'] },
  { key: 'mensal', label: 'Mensal', frequencias: ['Mensal'] },
];

const getPct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

const addDays = (dateKey: string, amount: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().split('T')[0];
};

const getDayOfYear = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
};

const getAlertaTexto = (alerta: VencimentoAlerta) => {
  if (alerta.diasRestantes < 0) return 'Vencido';
  if (alerta.diasRestantes === 0) return 'Vence hoje';
  return `Vence em ${alerta.diasRestantes} dias`;
};

const isDone = (tarefa: TarefaGestor) => tarefa.status === 'Concluída';

type InicioPageProps = {
  onInitialReady?: () => void;
};

export const InicioPage: React.FC<InicioPageProps> = ({ onInitialReady }) => {
  useInicioRealtime(true);
  const { stats, vencimentosProximos, isLoading } = useInicio();
  const { openTab } = useInternalTabs();

  const hoje = todayKey();
  const fimSemana = addDays(hoje, 6);
  const alertasCriticos = vencimentosProximos.length > 0 ? vencimentosProximos.slice(0, 4) : alertasPadrao;

  const fraseMotivacionalFallback: FraseMotivacional = useMemo(
    () => frasesMotivacionais[(getDayOfYear(hoje) - 1 + frasesMotivacionais.length) % frasesMotivacionais.length],
    [hoje],
  );
  const {
    tarefasWorkspace,
    eventosAgenda,
    showConfigNotice,
    noticeType,
    fraseMotivacional,
  } = useInicioBootstrap({
    hoje,
    fraseFallback: fraseMotivacionalFallback,
    dashboardReady: !isLoading,
    onReady: onInitialReady,
  });

  const agendaResumo = useMemo(() => {
    const eventos = eventosAgenda
      .filter((evento) => evento.data >= hoje && evento.data <= fimSemana)
      .sort((a, b) => a.data.localeCompare(b.data));

    return {
      hoje: eventos.filter((evento) => evento.data === hoje).slice(0, 5),
      semana: eventos.filter((evento) => evento.data !== hoje).slice(0, 6),
    };
  }, [eventosAgenda, fimSemana, hoje]);

  const tarefasResumo = useMemo(() => {
    const tarefas = tarefasWorkspace;
    const pendentes = tarefas
      .filter((tarefa) => !isDone(tarefa))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 6);

    const atividadesHoje = tarefas
      .filter((tarefa) => tarefa.vencimento === hoje)
      .sort((a, b) => Number(isDone(a)) - Number(isDone(b)))
      .slice(0, 5);

    const responsaveis = Array.from(new Set(tarefas.map((tarefa) => tarefa.responsavel).filter(Boolean)));
    const usuarios = responsaveis.map((usuario) => {
      const userTasks = tarefas.filter((tarefa) => tarefa.responsavel === usuario);
      const periodos = Object.fromEntries(periodoConfig.map((periodo) => {
        const items = userTasks.filter((tarefa) => periodo.frequencias.includes(tarefa.frequencia as FrequenciaAtividade));
        const done = items.filter(isDone).length;
        return [periodo.key, { total: items.length, done, pct: getPct(done, items.length) }];
      })) as Record<PeriodoChave, { total: number; done: number; pct: number }>;

      const doneTotal = userTasks.filter(isDone).length;
      const atrasadas = userTasks.filter((tarefa) => !isDone(tarefa) && tarefa.vencimento < hoje).length;
      return {
        usuario,
        total: userTasks.length,
        done: doneTotal,
        atrasadas,
        pct: getPct(doneTotal, userTasks.length),
        periodos,
      };
    });

    const total = tarefas.length;
    const done = tarefas.filter(isDone).length;
    const atrasadas = tarefas.filter((tarefa) => !isDone(tarefa) && tarefa.vencimento < hoje).length;

    return {
      total,
      done,
      atrasadas,
      pct: getPct(done, total),
      pendentes,
      atividadesHoje,
      usuarios,
    };
  }, [hoje, tarefasWorkspace]);

  if (isLoading) {
    return <div className="inicio-loading">Carregando painel contábil...</div>;
  }

  if (!stats) {
    return <div className="inicio-loading">Não foi possível carregar o painel contábil.</div>;
  }

  return (
    <div className="inicio-page">
      {showConfigNotice && noticeType && (
        <div className="company-config-warning-banner animate-fade-in">
          <div className="warning-banner-content">
            <AlertTriangle className="warning-icon" size={20} />
            {noticeType === 'address' ? (
              <span>
                <strong>Cadastro da Empresa Incompleto:</strong> Os dados de endereço e contato de sua empresa ainda estão usando valores de demonstração ou incompletos. Complete o cadastro para que saiam corretos nos cabeçalhos de seus documentos.
              </span>
            ) : (
              <span>
                <strong>Identidade Visual Incompleta:</strong> Você ainda não configurou as marcas d'água da sua empresa. Carregue as imagens de paisagem e retrato para personalizar os cabeçalhos de relatórios.
              </span>
            )}
          </div>
          <button 
            className="btn-complete-config"
            onClick={() => {
              openTab('configuracoes', 'Configurações', 'Settings');
              const subTabTarget = noticeType === 'address' ? 'empresa' : 'marca-dagua';
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open_config_subtab', { detail: { subTab: subTabTarget } }));
              }, 100);
            }}
          >
            <Settings size={14} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />
            {noticeType === 'address' ? 'Completar Cadastro' : 'Configurar Marca d\'Água'}
          </button>
        </div>
      )}

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
          <blockquote>"{fraseMotivacional.texto}"</blockquote>
          <cite>— {fraseMotivacional.autor}</cite>
        </div>
      </section>

      <section className="inicio-metrics-grid">
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon gold"><ListChecks size={22} /></div>
          <span>Atividades gerais</span>
          <strong>{tarefasResumo.pct}%</strong>
          <small>{tarefasResumo.done}/{tarefasResumo.total} concluidas</small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon orange"><AlertTriangle size={22} /></div>
          <span>Prazos pendentes</span>
          <strong>{tarefasResumo.pendentes.length + alertasCriticos.length}</strong>
          <small>{tarefasResumo.atrasadas} atividades atrasadas</small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon blue"><CalendarRange size={22} /></div>
          <span>Agenda da semana</span>
          <strong>{agendaResumo.hoje.length + agendaResumo.semana.length}</strong>
          <small>{agendaResumo.hoje.length} item hoje</small>
        </article>
        <article className="inicio-metric-card">
          <div className="inicio-metric-icon green"><Users size={22} /></div>
          <span>Equipe monitorada</span>
          <strong>{tarefasResumo.usuarios.length}</strong>
          <small>{stats.empresasAtivas} empresas no radar</small>
        </article>
      </section>

      <section className="inicio-dashboard-grid">
        <article className="inicio-panel inicio-panel-agenda">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Agenda</span>
              <h2>Hoje</h2>
            </div>
            <Clock3 size={20} />
          </div>

          <div className="inicio-agenda-list">
            {agendaResumo.hoje.length === 0 ? (
              <div className="inicio-empty-row">Nenhum compromisso para hoje.</div>
            ) : agendaResumo.hoje.map((evento) => {
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
              <span className="inicio-kicker">Proximos dias</span>
              <h2>Semana operacional</h2>
            </div>
            <CalendarRange size={20} />
          </div>

          <div className="inicio-week-list">
            {agendaResumo.semana.map((evento) => {
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
              <span className="inicio-kicker">Pendencias</span>
              <h2>Prazos e riscos</h2>
            </div>
            <ShieldAlert size={20} />
          </div>

          <div className="inicio-risk-list">
            {alertasCriticos.map((alerta) => (
              <div className={`inicio-risk-row ${alerta.diasRestantes <= 0 ? 'late' : ''}`} key={alerta.id}>
                {alerta.tipo === 'certificado' ? <ShieldAlert size={17} /> : <FileClock size={17} />}
                <div>
                  <strong>{alerta.nome}</strong>
                  <small>{alerta.empresaNome} - {alerta.dataValidade}</small>
                </div>
                <span>{getAlertaTexto(alerta)}</span>
              </div>
            ))}
            {tarefasResumo.pendentes.slice(0, 3).map((tarefa) => (
              <div className={`inicio-risk-row ${tarefa.vencimento < hoje ? 'late' : ''}`} key={tarefa.id}>
                <ListChecks size={17} />
                <div>
                  <strong>{tarefa.titulo}</strong>
                  <small>{tarefa.responsavel} - {tarefa.cliente}</small>
                </div>
                <span>{formatDateBR(tarefa.vencimento)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="inicio-panel inicio-panel-activity">
          <div className="inicio-panel-header">
            <div>
              <span className="inicio-kicker">Atividades</span>
              <h2>Algumas tarefas de hoje</h2>
            </div>
            <CheckCircle2 size={20} />
          </div>

          <div className="inicio-task-list">
            {tarefasResumo.atividadesHoje.length === 0 ? (
              <div className="inicio-empty-row">Nenhuma atividade com vencimento hoje.</div>
            ) : tarefasResumo.atividadesHoje.map((tarefa) => (
              <div className="inicio-task-row" key={tarefa.id}>
                <span className={`inicio-status-pill ${tarefa.status === 'Concluída' ? 'done' : tarefa.status === 'Em andamento' ? 'progress' : 'pending'}`}>
                  {tarefa.status}
                </span>
                <div>
                  <strong>{tarefa.titulo}</strong>
                  <small>{tarefa.responsavel} - {tarefa.frequencia} - {tarefa.cliente}</small>
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
            <h2>Andamento por usuario</h2>
          </div>
          <BarChart3 size={20} />
        </div>

        <div className="inicio-user-grid">
          {tarefasResumo.usuarios.map((usuario) => (
            <article className="inicio-user-card" key={usuario.usuario}>
              <div className="inicio-user-head">
                <div className="inicio-avatar">{usuario.usuario.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{usuario.usuario}</strong>
                  <small>{usuario.done}/{usuario.total} atividades</small>
                </div>
                <span>{usuario.pct}%</span>
              </div>

              <div className="inicio-progress-track">
                <div style={{ width: `${usuario.pct}%` }} />
              </div>

              <div className="inicio-period-grid">
                {periodoConfig.map((periodo) => {
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
                  {usuario.atrasadas} atrasada(s)
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
