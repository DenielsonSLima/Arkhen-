import React from 'react';
import { CalendarDays, CalendarRange, ShieldAlert } from 'lucide-react';
import { AgendaEventosList } from './AgendaEventosList';
import type { Evento } from '../services/agenda.service';

interface VencimentoResumo {
  id: string;
  tipo: string;
  nome: string;
  diasRestantes: number;
  empresaNome: string;
  dataValidade: string;
}

interface EventosPorOrigem {
  manualDia: Evento[];
  manualProximos: Evento[];
  calendarioDia: Evento[];
  calendarioProximos: Evento[];
  prazosDia: Evento[];
  prazosProximos: Evento[];
  atividadesDia: Evento[];
  atividadesProximas: Evento[];
}

interface AgendaEventosBoardProps {
  eventosPorOrigem: EventosPorOrigem;
  vencimentos: VencimentoResumo[];
  formattedSelectedDate: string;
  onEdit: (evento: Evento) => void;
  onDeleteRequest: (evento: Evento) => void;
  onToggleComplete: (eventoId: string) => void;
}

export const AgendaEventosBoard: React.FC<AgendaEventosBoardProps> = ({
  eventosPorOrigem,
  vencimentos,
  formattedSelectedDate,
  onEdit,
  onDeleteRequest,
  onToggleComplete,
}) => (
  <div className="agenda-body agenda-body-eventos">
    <div className="agenda-painel agenda-origem-grid">
      <div className="agenda-painel-section agenda-origem-section">
        <div className="agenda-section-title">
          <h3><CalendarDays size={14} /> Agenda</h3>
          <span>Eventos manuais</span>
        </div>
        <AgendaSubsection title={formattedSelectedDate || 'Dia selecionado'}>
          <AgendaEventosList eventos={eventosPorOrigem.manualDia} vazio="Nenhum evento manual neste dia." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
        <AgendaSubsection title="Próximos eventos">
          <AgendaEventosList eventos={eventosPorOrigem.manualProximos} vazio="Nenhum evento manual futuro." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
        <AgendaSubsection title="Calendário oficial">
          <AgendaEventosList
            eventos={eventosPorOrigem.calendarioDia.length ? eventosPorOrigem.calendarioDia : eventosPorOrigem.calendarioProximos}
            vazio={eventosPorOrigem.calendarioDia.length ? 'Nenhuma data oficial neste dia.' : 'Nenhuma data oficial futura.'}
            onEdit={onEdit}
            onDeleteRequest={onDeleteRequest}
            onToggleComplete={onToggleComplete}
          />
        </AgendaSubsection>
      </div>

      <div className="agenda-painel-section agenda-origem-section">
        <div className="agenda-section-title">
          <h3><ShieldAlert size={14} /> Prazos Recorrentes</h3>
          <span>Obrigação fiscal</span>
        </div>
        <AgendaSubsection title={formattedSelectedDate || 'Dia selecionado'}>
          <AgendaEventosList eventos={eventosPorOrigem.prazosDia} vazio="Nenhum prazo fiscal neste dia." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
        <AgendaSubsection title="Próximos prazos">
          <AgendaEventosList eventos={eventosPorOrigem.prazosProximos} vazio="Nenhum prazo fiscal futuro." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
      </div>

      <div className="agenda-painel-section agenda-origem-section">
        <div className="agenda-section-title">
          <h3><CalendarRange size={14} /> Tarefas de Atividades</h3>
          <span>Integração operacional</span>
        </div>
        <AgendaSubsection title={formattedSelectedDate || 'Dia selecionado'}>
          <AgendaEventosList eventos={eventosPorOrigem.atividadesDia} vazio="Nenhuma tarefa de atividade neste dia." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
        <AgendaSubsection title="Próximas tarefas">
          <AgendaEventosList eventos={eventosPorOrigem.atividadesProximas} vazio="Nenhuma tarefa de atividade futura." onEdit={onEdit} onDeleteRequest={onDeleteRequest} onToggleComplete={onToggleComplete} />
        </AgendaSubsection>
        {vencimentos.length > 0 && (
          <AgendaSubsection title="Docs & certificados">
            <div className="agenda-vencimentos-lista">
              {vencimentos.map((vencimento) => (
                <div key={vencimento.id} className={`agenda-vencimento-item ${vencimento.diasRestantes < 0 ? 'vencido' : ''}`}>
                  <div>
                    <span>{vencimento.tipo === 'certificado' ? 'Cert.' : 'Doc.'} {vencimento.nome}</span>
                    <strong>{vencimento.diasRestantes < 0 ? 'Vencido' : `Em ${vencimento.diasRestantes}d`}</strong>
                  </div>
                  <small>{vencimento.empresaNome} • Val. {vencimento.dataValidade}</small>
                </div>
              ))}
            </div>
          </AgendaSubsection>
        )}
      </div>
    </div>
  </div>
);

const AgendaSubsection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="agenda-subsection">
    <strong>{title}</strong>
    {children}
  </div>
);
