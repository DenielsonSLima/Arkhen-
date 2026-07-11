import React from 'react';
import { Calendar, User, ChevronRight, Users, UserCheck, Receipt, Calendar as CalendarIcon, Hammer, ClipboardList } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';

interface CompanyActivityCardProps {
  group: CompanyActivityGroup;
  competencia: string;
  onSelect: () => void;
}

export const isRealLogo = (logo: string | undefined): boolean => {
  if (!logo) return false;
  const trimmed = logo.trim();
  return trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
};

export const renderCompanyLogo = (logo: string | undefined, name: string, regime: string, size: 'small' | 'large' = 'small') => {
  const isLarge = size === 'large';
  const dimensions = isLarge
    ? { width: '56px', height: '56px', fontSize: '1.2rem', borderRadius: '12px' }
    : { width: '36px', height: '36px', fontSize: '0.8rem', borderRadius: '8px' };

  if (isRealLogo(logo)) {
    return (
      <img
        src={logo}
        alt={name}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
          objectFit: 'cover',
          border: '1px solid #e2e8f0',
          flexShrink: 0
        }}
      />
    );
  }

  // Initials Fallback
  const initials = name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  let gradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  if (regime === 'Simples Nacional') {
    gradient = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
  } else if (regime === 'Lucro Presumido') {
    gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  } else if (regime === 'Lucro Real') {
    gradient = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
  }

  return (
    <div style={{
      width: dimensions.width,
      height: dimensions.height,
      borderRadius: dimensions.borderRadius,
      background: gradient,
      color: '#ffffff',
      fontWeight: 700,
      fontSize: isLarge ? '1.2rem' : '0.8rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      {initials || 'CO'}
    </div>
  );
};

export const getActivityMiniIcon = (modeloId: string, status: string, size = 13) => {
  let color = '#94a3b8'; // pending gray
  if (status === 'Concluída') color = '#10b981'; // emerald
  else if (status === 'Em andamento') color = '#f59e0b'; // amber
  else if (status === 'Pendente') color = '#ef4444'; // rose

  switch (modeloId) {
    case 'folha':
      return <Users size={size} style={{ color }} />;
    case 'prolabore':
      return <UserCheck size={size} style={{ color }} />;
    case 'dctfweb':
      return <Receipt size={size} style={{ color }} />;
    case 'obrigacoes':
      return <CalendarIcon size={size} style={{ color }} />;
    case 'obras':
      return <Hammer size={size} style={{ color }} />;
    default:
      return <ClipboardList size={size} style={{ color }} />;
  }
};

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {renderCompanyLogo(group.logo, group.clienteNome, group.regime, 'small')}
          <div>
            <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
              {group.clienteNome}
            </h4>
            <span className={`partner-badge ${group.regime === 'Simples Nacional' ? 'mei' : group.regime === 'Lucro Presumido' ? 'lucro-presumido' : 'lucro-real'}`} style={{ fontSize: '0.6rem', padding: '1px 5px', display: 'inline-block', marginTop: '2px' }}>
              {group.regime}
            </span>
          </div>
        </div>
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
            style={{ width: `${group.progressoGeral}%` }}
          ></div>
        </div>
      </div>

      {/* Semaphore of sub-activities */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
        {group.atividades.map((atv) => (
          <div key={atv.instanciaId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {getActivityMiniIcon(atv.modeloId, atv.status)}
              <span style={{ fontWeight: 500, color: '#334155' }}>{atv.modeloNome}</span>
            </div>
            <span style={{
              fontWeight: 600,
              color: atv.status === 'Concluída' ? '#2e7d32' : atv.status === 'Em andamento' ? '#ed6c02' : '#64748b'
            }}>
              {atv.status === 'Concluída' ? 'Concluído' : atv.status === 'Em andamento' ? `${atv.progresso}%` : 'Pendente'}
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
