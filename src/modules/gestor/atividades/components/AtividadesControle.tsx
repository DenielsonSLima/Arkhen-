import React, { useMemo } from 'react';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, Users } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { todayKey } from '../services/rotinasAtividadesService';

export const AtividadesControle: React.FC = () => {
  const { tarefas } = useAtividadesWorkspace();

  // Métricas gerais
  const metrics = useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => t.status === 'Concluída').length;
    const emAndamento = tarefas.filter((t) => t.status === 'Em andamento').length;
    const pendentes = tarefas.filter((t) => t.status === 'Pendente').length;
    const atrasadas = tarefas.filter((t) => t.status !== 'Concluída' && t.vencimento < todayKey()).length;
    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return { total, concluidas, emAndamento, pendentes, atrasadas, pct };
  }, [tarefas]);

  // Estatísticas por colaborador
  const workerStats = useMemo(() => {
    const responsaveis = Array.from(new Set(tarefas.map((tarefa) => tarefa.responsavel).filter(Boolean)));
    return responsaveis.map((nome) => {
      const userTasks = tarefas.filter((t) => t.responsavel === nome);
      const concluidas = userTasks.filter((t) => t.status === 'Concluída').length;
      const total = userTasks.length;
      const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

      return { nome, total, concluidas, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [tarefas]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>


      {/* Grid de Métricas */}
      <div style={metricsGridStyle}>
        <div style={metricCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={metricLabelStyle}>Progresso Geral</span>
            <CheckCircle2 size={20} color="#10b981" />
          </div>
          <strong style={{ ...metricValueStyle, color: '#10b981' }}>{metrics.pct}%</strong>
          <span style={metricSubStyle}>{metrics.concluidas} de {metrics.total} tarefas feitas</span>
        </div>

        <div style={metricCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={metricLabelStyle}>Atrasadas</span>
            <Clock size={20} color="#ef4444" />
          </div>
          <strong style={{ ...metricValueStyle, color: '#ef4444' }}>{metrics.atrasadas}</strong>
          <span style={metricSubStyle}>Requer atenção imediata</span>
        </div>

        <div style={metricCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={metricLabelStyle}>Em Andamento</span>
            <BarChart3 size={20} color="var(--color-gold-dark)" />
          </div>
          <strong style={{ ...metricValueStyle, color: 'var(--color-gold-dark)' }}>{metrics.emAndamento}</strong>
          <span style={metricSubStyle}>Sendo executadas agora</span>
        </div>

        <div style={metricCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={metricLabelStyle}>Pendentes</span>
            <AlertTriangle size={20} color="#f97316" />
          </div>
          <strong style={{ ...metricValueStyle, color: '#f97316' }}>{metrics.pendentes}</strong>
          <span style={metricSubStyle}>Aguardando início</span>
        </div>
      </div>

      {/* Produtividade da Equipe */}
      <div style={panelCardStyle}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users size={18} color="var(--color-gold-primary)" />
          Conclusão por Colaborador
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {workerStats.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
              Nenhuma atividade cadastrada no Supabase.
            </p>
          ) : workerStats.map((w) => (
            <div key={w.nome} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{w.nome}</span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  {w.pct}% ({w.concluidas} / {w.total})
                </span>
              </div>
              <div style={progressContainerStyle}>
                <div style={{
                  ...progressFillStyle,
                  width: `${w.pct}%`,
                  backgroundColor: w.pct === 100 ? '#10b981' : 'var(--color-gold-primary)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Estilos Tema Claro
const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '16px',
};

const metricCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '4px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
};

const metricLabelStyle = {
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const metricValueStyle = {
  fontSize: '1.8rem',
  fontWeight: 700,
  marginTop: '4px',
};

const metricSubStyle = {
  fontSize: '0.72rem',
  color: '#64748b',
  fontWeight: 500,
};

const panelCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
};

const progressContainerStyle = {
  width: '100%',
  height: '8px',
  backgroundColor: '#f1f5f9',
  borderRadius: '4px',
  overflow: 'hidden',
};

const progressFillStyle = {
  height: '100%',
  borderRadius: '4px',
  transition: 'width 0.3s ease',
};
