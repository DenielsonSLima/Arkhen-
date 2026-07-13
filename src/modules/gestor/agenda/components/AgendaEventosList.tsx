import React from 'react';
import { EventoCard } from './EventoCard';
import { getEventoOrigem, type Evento } from '../services/agenda.service';

interface AgendaEventosListProps {
  eventos: Evento[];
  vazio: string;
  onEdit: (evento: Evento) => void;
  onDeleteRequest: (evento: Evento) => void;
}

export const AgendaEventosList: React.FC<AgendaEventosListProps> = ({
  eventos,
  vazio,
  onEdit,
  onDeleteRequest,
}) => (
  eventos.length === 0 ? (
    <div className="sem-eventos">{vazio}</div>
  ) : (
    <div className="agenda-eventos-lista">
      {eventos.map((evento) => (
        <EventoCard
          key={evento.id}
          evento={evento}
          onEdit={onEdit}
          onDeleteRequest={getEventoOrigem(evento) === 'manual' ? onDeleteRequest : undefined}
        />
      ))}
    </div>
  )
);
