import React from 'react';
import { ArrowLeft, CalendarDays, CircleCheck, ClipboardList, UserRound } from 'lucide-react';
import type { FechamentoOperacionalGrupo } from '../services/fechamentosOperacionaisService';
import { CompanyCardIdentity } from '../por-empresa/CompanyCardIdentity';

interface FechamentoOperacionalDetailProps {
  group: FechamentoOperacionalGrupo;
  onBack: () => void;
}

const statusColor: Record<string, string> = {
  Concluída: '#15803d',
  'Em andamento': '#b7791f',
  Pendente: '#64748b',
};

export const FechamentoOperacionalDetail: React.FC<FechamentoOperacionalDetailProps> = ({ group, onBack }) => (
  <div className="atividades-layout-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="atividades-filter-header" style={{ padding: '12px 20px' }}>
      <button className="btn-add-user" type="button" onClick={onBack} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <ArrowLeft size={16} /> Voltar para Fechamentos
      </button>
    </div>
    <section className="model-preset-card" style={{ padding: '24px', borderTop: '5px solid var(--color-gold-primary)' }}>
      <CompanyCardIdentity name={group.clienteNome} cnpj={group.cnpj} regime={group.regime} tipoEstabelecimento={group.tipoEstabelecimento} />
      <div className="detail-meta-horizontal" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '20px' }}>
        <span><CalendarDays size={15} /> Competência: <strong>{group.competencia}</strong></span>
        <span><UserRound size={15} /> Responsável: <strong>{group.responsavel || 'Não atribuído'}</strong></span>
        <span><CircleCheck size={15} color={statusColor[group.statusGeral]} /> Status: <strong style={{ color: statusColor[group.statusGeral] }}>{group.statusGeral} ({group.progressoGeral}%)</strong></span>
      </div>
    </section>
    <section className="model-preset-card" style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '1.15rem' }}>Obrigações da competência</h2>
      <p style={{ margin: '0 0 18px', color: '#64748b' }}>Tarefas criadas automaticamente a partir das obrigações ativas deste cliente.</p>
      <div style={{ display: 'grid', gap: '10px' }}>
        {group.tarefas.map((tarefa) => (
          <article key={tarefa.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <div>
              <strong style={{ color: '#0f172a' }}>{tarefa.titulo}</strong>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '4px' }}>{tarefa.categoria} · {tarefa.frequencia} · Vencimento: {tarefa.vencimento || 'sem prazo'}</div>
            </div>
            <span style={{ color: statusColor[tarefa.status], fontWeight: 700, whiteSpace: 'nowrap' }}>{tarefa.status} ({tarefa.progresso}%)</span>
          </article>
        ))}
      </div>
      {group.tarefas.length === 0 && <p style={{ color: '#64748b' }}><ClipboardList size={16} /> Não há tarefas para esta competência.</p>}
    </section>
  </div>
);
