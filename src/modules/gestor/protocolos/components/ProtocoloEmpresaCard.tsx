import React from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
    User,
} from 'lucide-react';
import type { EmpresaProtocolosGrupo } from '../hooks/useProtocolos';
import type { ProtocoloEntrega } from '../services/protocolosService';
import './ProtocoloEmpresaCard.css';

interface ProtocoloEmpresaCardProps {
  group: EmpresaProtocolosGrupo;
  onOpen: () => void;
}

const formatCompetencia = (competencia: string) => {
  const [year, month] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

const formatDate = (value: string) => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const getStats = (items: ProtocoloEntrega[]) => ({
  pendentes: items.filter((item) => item.status === 'Pendente').length,
  concluidos: items.filter((item) => item.status === 'Concluído').length,
});


const getRegimeClass = (regime: string) => {
  switch (regime) {
    case 'MEI': return 'mei';
    case 'Simples Nacional': return 'simples';
    case 'Lucro Presumido': return 'presumido';
    case 'Lucro Real': return 'real';
    default: return 'default';
  }
};

const getPartnerBadgeClass = (regime: string) => {
  if (regime === 'MEI' || regime === 'Simples Nacional') return 'mei';
  if (regime === 'Lucro Presumido') return 'lucro-presumido';
  return 'lucro-real';
};

const getInitials = (name: string) => {
  const initials = name
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
  return initials || name.slice(0, 2).toUpperCase();
};

const isRealLogo = (logo: string | undefined) => {
  if (!logo) return false;
  const trimmed = logo.trim();
  return trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
};

export const ProtocoloEmpresaCard: React.FC<ProtocoloEmpresaCardProps> = ({ group, onOpen }) => {
  const stats = getStats(group.items);
  const proximoItem = [...group.items].sort((a, b) => a.prazo.localeCompare(b.prazo))[0];
    const regimeClass = getRegimeClass(group.empresaTipo);

  return (
    <article
      className={`model-preset-card protocolo-company-card regime-${regimeClass} animate-fade-in`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
    >
      <div className="protocolo-company-card-head">
        {isRealLogo(group.empresaLogo) ? (
          <img className="protocolo-company-logo-img" src={group.empresaLogo} alt={`Logo ${group.empresaNome}`} />
        ) : (
          <span className="protocolo-company-logo-initials">{getInitials(group.empresaNome)}</span>
        )}

        <div className="protocolo-company-title">
          <h2>{group.empresaNome}</h2>
          <p>{group.empresaCnpj}</p>
          <div className="protocolo-company-card-badges">
            <span className={`partner-badge ${getPartnerBadgeClass(group.empresaTipo)}`}>{group.empresaTipo}</span>
            <span className={`protocolo-estab-badge ${group.empresaTipoEstabelecimento.toLowerCase()}`}>{group.empresaTipoEstabelecimento}</span>
          </div>
        </div>
      </div>

      {proximoItem && (
        <div className="protocolo-company-competencia">
          <Calendar size={12} />
          <span>
            Referência: <strong>{formatCompetencia(proximoItem.competencia)}</strong>
            {proximoItem.periodoReferencia !== 'Mensal' ? ` • ${proximoItem.periodoReferencia}` : ''}
          </span>
        </div>
      )}

      <div className="protocolo-company-filebar tone-success">
        <div>
          <span>Progresso</span>
          <strong>{stats.concluidos}/{group.items.length}</strong>
        </div>
        <i><b style={{ transform: `scaleX(${group.items.length ? stats.concluidos / group.items.length : 0})` }} /></i>
      </div>

      <div className="protocolo-company-stat-list">
        <div><Clock size={13} /><span>Pendentes</span><strong>{stats.pendentes}</strong></div>
        <div><CheckCircle2 size={13} /><span>Concluídos</span><strong>{stats.concluidos}</strong></div>
      </div>

      <div className="protocolo-company-card-footer">
        <span>
          <User size={12} />
          <span>Resp: <strong>{proximoItem?.responsavel || 'Administrador'}</strong></span>
        </span>
        <strong>
          {proximoItem ? `Prazo ${formatDate(proximoItem.prazo)}` : 'Detalhes'}
          <ChevronRight size={12} />
        </strong>
      </div>
    </article>
  );
};
