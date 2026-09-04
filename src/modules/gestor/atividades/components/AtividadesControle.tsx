import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { usePainelOperacional } from '../queries/painelOperacionalQueries';
import {
  type NivelRiscoOperacional,
  type PainelPeriodo,
} from '../services/painelOperacionalService';
import { formatDateBR, todayKey } from '../services/rotinasAtividadesService';
import './AtividadesControle.css';

interface AtividadesControleProps {
  initialCompanyId?: string;
  initialCompanyName?: string;
  initialCompetencia?: string;
}

const PERIOD_LABELS: Record<PainelPeriodo, string> = {
  dia: 'Hoje',
  semana: 'Semana',
  mes: 'Mês',
  todos: 'Todos',
};

const RISK_LABELS: Record<NivelRiscoOperacional, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Atenção',
  baixo: 'Baixo',
  concluido: 'Concluído',
};

const dueLabel = (days: number) => {
  if (days < 0) return `${Math.abs(days)} dia(s) em atraso`;
  if (days === 0) return 'Vence hoje';
  return `Vence em ${days} dia(s)`;
};

const competenciaReferenceDate = (competencia?: string) => {
  if (!competencia) return todayKey();
  if (/^\d{4}-\d{2}$/.test(competencia)) return `${competencia}-01`;
  if (/^\d{2}\/\d{4}$/.test(competencia)) {
    const [month, year] = competencia.split('/');
    return `${year}-${month}-01`;
  }
  return todayKey();
};

export const AtividadesControle: React.FC<AtividadesControleProps> = ({
  initialCompanyId,
  initialCompanyName,
  initialCompetencia,
}) => {
  const [activePeriod, setActivePeriod] = useState<PainelPeriodo>('mes');
  const [scope, setScope] = useState<{
    companyId?: string;
    companyName?: string;
    competencia?: string;
  }>({
    companyId: initialCompanyId,
    companyName: initialCompanyName,
    competencia: initialCompetencia,
  });
  const dataReferencia = competenciaReferenceDate(scope.competencia);
  const painelQuery = usePainelOperacional(
    activePeriod,
    dataReferencia,
    scope.companyId,
  );
  const painel = painelQuery.data;
  const metricas = painel?.metricas;

  return (
    <div className="painel-operacional">
      <div className="painel-operacional__toolbar">
        <div className="painel-operacional__periods" aria-label="Período do painel">
          {(Object.keys(PERIOD_LABELS) as PainelPeriodo[]).map((periodo) => (
            <button
              key={periodo}
              type="button"
              className={activePeriod === periodo ? 'is-active' : ''}
              onClick={() => setActivePeriod(periodo)}
            >
              {PERIOD_LABELS[periodo]}
            </button>
          ))}
        </div>
        <button
          className="painel-operacional__refresh"
          type="button"
          onClick={() => { void painelQuery.refetch(); }}
          disabled={painelQuery.isFetching}
        >
          <RefreshCw size={15} />
          Atualizar
        </button>
      </div>

      {(scope.companyId || scope.competencia) && (
        <div className="painel-operacional__scope" role="status">
          <span>
            Recorte ativo: {scope.companyName || 'empresa selecionada'}
            {scope.competencia ? ` · competência ${scope.competencia}` : ''}
          </span>
          <button type="button" onClick={() => setScope({})}>
            Limpar recorte
          </button>
        </div>
      )}

      {painelQuery.isLoading ? (
        <div className="painel-operacional__state">Carregando indicadores operacionais…</div>
      ) : painelQuery.isError || !painel || !metricas ? (
        <div className="painel-operacional__state is-error">
          <AlertCircle size={18} />
          Não foi possível carregar o painel. Tente atualizar.
        </div>
      ) : (
        <>
          <section className="painel-operacional__metrics" aria-label="Indicadores">
            <article>
              <CheckCircle2 />
              <span>Entrega no prazo</span>
              <strong>{metricas.taxaNoPrazo}%</strong>
              <small>{metricas.concluidas} concluída(s)</small>
            </article>
            <article className={metricas.emRisco > 0 ? 'is-danger' : ''}>
              <ShieldAlert />
              <span>Em risco</span>
              <strong>{metricas.emRisco}</strong>
              <small>prioridade alta ou crítica</small>
            </article>
            <article className={metricas.atrasadas > 0 ? 'is-danger' : ''}>
              <Clock3 />
              <span>Atrasadas</span>
              <strong>{metricas.atrasadas}</strong>
              <small>exigem intervenção</small>
            </article>
            <article>
              <ListChecks />
              <span>Pendentes</span>
              <strong>{metricas.pendentes}</strong>
              <small>{metricas.emAndamento} em andamento</small>
            </article>
            <article>
              <CalendarClock />
              <span>Vencem hoje</span>
              <strong>{metricas.vencendoHoje}</strong>
              <small>{metricas.vencendoSeteDias} nos próximos 7 dias</small>
            </article>
            <article>
              <AlertTriangle />
              <span>Com pendência</span>
              <strong>{metricas.comPendencia}</strong>
              <small>motivo registrado</small>
            </article>
          </section>

          <section className="painel-operacional__body">
            <div className="painel-operacional__priority">
              <div className="painel-operacional__section-title">
                <div>
                  <h3>Prioridades de intervenção</h3>
                  <p>Exceções ordenadas pelo risco e pelo prazo operacional.</p>
                </div>
                <span>{painel.riscos.length} item(ns)</span>
              </div>
              <div className="painel-operacional__risk-list">
                {painel.riscos.length === 0 ? (
                  <div className="painel-operacional__empty">
                    Nenhum risco no recorte atual.
                  </div>
                ) : painel.riscos.map((risco) => (
                  <article key={risco.tarefaId} className="painel-operacional__risk-card">
                    <div className="painel-operacional__risk-main">
                      <span className={`risk-badge risk-badge--${risco.nivelRisco}`}>
                        {RISK_LABELS[risco.nivelRisco]}
                      </span>
                      <div>
                        <strong>{risco.titulo}</strong>
                        <p>{risco.cliente} · {risco.responsavel}</p>
                      </div>
                    </div>
                    <div className="painel-operacional__risk-meta">
                      <span>{risco.categoria}</span>
                      <span>{formatDateBR(risco.prazoInterno)}</span>
                      <strong>{dueLabel(risco.diasParaVencimento)}</strong>
                    </div>
                    <div className="painel-operacional__signals">
                      {risco.motivoPendencia && <span>Pendência registrada</span>}
                      {risco.evidenciaRegistrada && <span><FileCheck2 size={13} /> Evidência</span>}
                      {risco.revisaoPendente && <span>Aguardando revisão</span>}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="painel-operacional__rankings">
              <RankingCard
                icon={<Users size={17} />}
                title="Por responsável"
                rows={painel.colaboradores.map((item) => ({
                  id: item.responsavelConfigUsuarioId,
                  nome: item.responsavel,
                  total: item.total,
                  atrasadas: item.atrasadas,
                  emRisco: item.emRisco,
                  detail: `${item.taxaNoPrazo}% no prazo`,
                }))}
              />
              <RankingCard title="Por cliente" rows={painel.rankings.clientes} />
              <RankingCard title="Por rotina" rows={painel.rankings.rotinas} />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

interface RankingRow {
  id?: string;
  nome: string;
  total: number;
  atrasadas: number;
  emRisco: number;
  detail?: string;
}

const RankingCard: React.FC<{
  icon?: React.ReactNode;
  title: string;
  rows: RankingRow[];
}> = ({ icon, title, rows }) => (
  <article className="painel-operacional__ranking-card">
    <h3>{icon}{title}</h3>
    {rows.length === 0 ? (
      <p className="painel-operacional__ranking-empty">Sem dados neste período.</p>
    ) : rows.slice(0, 6).map((row) => (
      <div key={row.id || row.nome} className="painel-operacional__ranking-row">
        <div>
          <strong>{row.nome}</strong>
          <small>{row.detail || `${row.total} atividade(s)`}</small>
        </div>
        <span>{row.emRisco} risco · {row.atrasadas} atraso</span>
      </div>
    ))}
  </article>
);
