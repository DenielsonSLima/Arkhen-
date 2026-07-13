import React from 'react';
import { Clock, Building2, UserRound, Pencil, Trash2 } from 'lucide-react';
import { getEventoCategoriaConfig, getEventoOrigemConfig, type Evento } from '../services/agenda.service';

interface EventoCardProps {
  evento: Evento;
  onEdit: (evento: Evento) => void;
  onDelete?: (eventoId: string) => void;
}

export const EventoCard: React.FC<EventoCardProps> = ({ evento, onEdit, onDelete }) => {
  const config = getEventoCategoriaConfig(evento) || { label: 'Evento', cor: '#64748b', corFundo: '#f1f5f9' };
  const origem = getEventoOrigemConfig(evento);
  const dataFormatada = new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  const isDeletingAllowed = !!onDelete;

  return (
    <div className="evento-item" onClick={() => onEdit(evento)}>
      <div className="evento-tipo-dot" style={{ backgroundColor: config.cor }} />
      <div className="evento-info">
        <div className="evento-card-topline">
          <span className="evento-card-badges">
            <span className={`evento-origem-chip ${origem.className}`}>
              {origem.label}
            </span>
            <span className="evento-categoria-chip" style={{ backgroundColor: config.corFundo, color: config.cor }}>
              {config.label}
            </span>
          </span>
          <span className="evento-data-chip">{dataFormatada}</span>
        </div>
        <div className="evento-titulo" title={evento.titulo}>
          {evento.titulo}
        </div>
        <div className="evento-meta">
          {evento.hora && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
              <Clock size={11} /> {evento.hora}
            </span>
          )}
          {evento.recorrente && (
            <span style={{ color: '#c59235', fontWeight: 600 }}>
              ↺ Recorrente ({evento.periodoRecorrencia})
            </span>
          )}
        </div>
        {evento.empresaNome && (
          <div className="evento-empresa" title={evento.empresaNome}>
            <Building2 size={11} /> {evento.empresaNome}
          </div>
        )}
        {evento.responsavelNome && (
          <div className="evento-empresa" title={`Responsável: ${evento.responsavelNome}`}>
            <UserRound size={11} /> {evento.responsavelNome}
            {evento.responsavelPerfil ? ` • ${evento.responsavelPerfil}` : ''}
          </div>
        )}
      </div>
      <div className="evento-acoes" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="evento-acao-btn"
          onClick={() => onEdit(evento)}
          title="Editar evento"
          aria-label="Editar evento"
        >
          <Pencil size={13} />
        </button>
        {isDeletingAllowed ? (
          <button
            type="button"
            className="evento-acao-btn delete"
            onClick={() => {
              if (window.confirm(`Deseja remover o evento "${evento.titulo}"?`)) {
                onDelete?.(evento.id);
              }
            }}
            title="Remover evento"
            aria-label="Remover evento"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
