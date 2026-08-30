import React from 'react';
import { Calendar, User, ChevronRight } from 'lucide-react';
import type { FechamentoOperacionalGrupo } from '../services/fechamentosOperacionaisService';
import { CompanyCardIdentity } from './CompanyCardIdentity';
import { getActivityMiniIcon } from './companyActivityPresentation';

interface CompanyActivityCardProps {
  group: FechamentoOperacionalGrupo;
  competencia: string;
  onSelect: () => void;
}

const getProgressTone = (progress: number) => {
  if (progress >= 100) return 'success';
  if (progress >= 50) return 'warning';
  return 'danger';
};

export const CompanyActivityCard: React.FC<CompanyActivityCardProps> = ({
  group,
  competencia,
  onSelect,
}) => {
  const progressTone = getProgressTone(group.progressoGeral);

  return (
    <div
      className="model-preset-card"
      style={{
        borderTop: '5px solid var(--color-gold-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        cursor: 'pointer',
        borderRadius: '16px',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        borderRight: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.015)'
      }}
      onClick={onSelect}
    >
      <div>
        <CompanyCardIdentity
          name={group.clienteNome}
          cnpj={group.cnpj}
          regime={group.regime}
          tipoEstabelecimento={group.tipoEstabelecimento}
          logo={group.logo}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
          <Calendar size={12} />
          <span>Competência: <strong>{competencia}</strong></span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ margin: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', color: '#0f172a' }}>
          <span>Fechamento Geral</span>
          <span>{group.progressoGeral}%</span>
        </div>
        <div className={`progress-track-bg tone-${progressTone}`} style={{ height: '8px', borderRadius: '4px' }}>
          <div
            className={`progress-bar-fill tone-${progressTone}`}
            style={{ transform: `scaleX(${group.progressoGeral / 100})` }}
          ></div>
        </div>
      </div>

      {/* Semaphore of sub-activities */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
        {group.tarefas.map((tarefa) => (
          <div key={tarefa.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {getActivityMiniIcon(tarefa.categoria, tarefa.status)}
              <span style={{ fontWeight: 500, color: '#334155' }}>{tarefa.titulo}</span>
            </div>
            <span style={{
              fontWeight: 600,
              color: tarefa.status === 'Concluída' ? '#2e7d32' : tarefa.status === 'Em andamento' ? '#ed6c02' : '#64748b'
            }}>
              {tarefa.status === 'Concluída' ? 'Concluído' : tarefa.status === 'Em andamento' ? `${tarefa.progresso}%` : 'Pendente'}
            </span>
          </div>
        ))}
      </div>

      {/* Responsible footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: 'auto' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <User size={12} />
          <span>Resp: <strong style={{ color: '#0f172a' }}>{group.responsavel}</strong></span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--color-gold-dark)', fontWeight: 600 }}>
          Detalhes <ChevronRight size={12} />
        </span>
      </div>
    </div>
  );
};
