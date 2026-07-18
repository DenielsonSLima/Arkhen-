import React, { useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  getEventoCategoriaConfig,
  getEventoOrigem,
  getEventoOrigemConfig,
  type CategoriaEventoConfig,
  type Evento,
  type UsuarioAgenda,
} from '../services/agenda.service';

interface AgendaEquipeTableProps {
  eventos: Evento[];
  usuarios: UsuarioAgenda[];
  categoriasEvento: CategoriaEventoConfig[];
  onEdit: (evento: Evento) => void;
  onDeleteRequest: (evento: Evento) => void;
  onToggleComplete: (eventoId: string) => void;
}

interface GrupoFuncionario {
  id: string;
  nome: string;
  perfil: string;
  cor: string;
  eventos: Evento[];
}

const SEM_RESPONSAVEL_ID = 'sem-responsavel';

export const AgendaEquipeTable: React.FC<AgendaEquipeTableProps> = ({
  eventos,
  usuarios,
  categoriasEvento,
  onEdit,
  onDeleteRequest,
  onToggleComplete,
}) => {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const grupos = useMemo(() => {
    const usuariosMap = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
    const gruposMap = new Map<string, GrupoFuncionario>();

    eventos.forEach((evento) => {
      const id = evento.responsavelId || evento.responsavelNome || SEM_RESPONSAVEL_ID;
      const usuario = evento.responsavelId ? usuariosMap.get(evento.responsavelId) : undefined;
      const nome = evento.responsavelNome || usuario?.nome || 'Sem responsável';
      const perfil = evento.responsavelPerfil || usuario?.perfil || 'Sem perfil';

      if (!gruposMap.has(id)) {
        gruposMap.set(id, {
          id,
          nome,
          perfil,
          cor: usuario?.cor || (id === SEM_RESPONSAVEL_ID ? '#94a3b8' : '#64748b'),
          eventos: [],
        });
      }

      gruposMap.get(id)?.eventos.push(evento);
    });

    return Array.from(gruposMap.values())
      .map((grupo) => ({
        ...grupo,
        eventos: grupo.eventos.sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, 'pt-BR')),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [eventos, usuarios]);

  const toggleGrupo = (grupoId: string) => {
    setExpandidos((atual) => ({ ...atual, [grupoId]: !(atual[grupoId] ?? true) }));
  };

  if (grupos.length === 0) {
    return (
      <section className="agenda-equipe-panel">
        <div className="agenda-equipe-empty">
          <UserRound size={20} />
          <strong>Nenhum evento encontrado para a equipe.</strong>
          <span>Ajuste os filtros para visualizar a agenda por funcionário.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="agenda-equipe-panel">
      <div className="agenda-equipe-header">
        <div>
          <h2><UserRound size={18} /> Agenda por funcionário</h2>
          <p>Eventos agrupados por responsável, com edição direta nas linhas.</p>
        </div>
        <strong>{eventos.length} registros</strong>
      </div>

      <div className="agenda-equipe-groups">
        {grupos.map((grupo) => {
          const isOpen = expandidos[grupo.id] ?? true;
          const concluidos = grupo.eventos.filter((evento) => evento.concluido).length;
          return (
            <div key={grupo.id} className="agenda-equipe-group">
              <button type="button" className="agenda-equipe-group-toggle" onClick={() => toggleGrupo(grupo.id)}>
                <span className="agenda-equipe-avatar" style={{ background: grupo.cor }}>
                  {grupo.nome.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{grupo.nome}</strong>
                  <small>{grupo.perfil}</small>
                </span>
                <span className="agenda-equipe-summary">{concluidos}/{grupo.eventos.length} concluídos</span>
                <ChevronDown size={16} className={isOpen ? 'open' : ''} />
              </button>

              {isOpen && (
                <div className="agenda-equipe-table-wrap">
                  <table className="agenda-equipe-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Evento</th>
                        <th>Empresa</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.eventos.map((evento) => (
                        <AgendaEquipeRow
                          key={evento.id}
                          evento={evento}
                          categoriasEvento={categoriasEvento}
                          onEdit={onEdit}
                          onDeleteRequest={onDeleteRequest}
                          onToggleComplete={onToggleComplete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const AgendaEquipeRow: React.FC<{
  evento: Evento;
  categoriasEvento: CategoriaEventoConfig[];
  onEdit: (evento: Evento) => void;
  onDeleteRequest: (evento: Evento) => void;
  onToggleComplete: (eventoId: string) => void;
}> = ({ evento, categoriasEvento, onEdit, onDeleteRequest, onToggleComplete }) => {
  const categoria = getEventoCategoriaConfig(evento, categoriasEvento);
  const origem = getEventoOrigemConfig(evento);
  const isManual = getEventoOrigem(evento) === 'manual';
  const dataFormatada = new Date(`${evento.data}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <tr>
      <td>
        <span className="agenda-equipe-date"><CalendarDays size={13} /> {dataFormatada}</span>
        {evento.hora && <small>{evento.hora}</small>}
      </td>
      <td>
        <strong>{evento.titulo}</strong>
        {evento.descricao && <small>{evento.descricao}</small>}
      </td>
      <td>
        <span className="agenda-equipe-company"><Building2 size={13} /> {evento.empresaNome || 'Todas'}</span>
      </td>
      <td>
        <span className={`evento-origem-chip ${origem.className}`}>{origem.label}</span>
        <span className="evento-categoria-chip" style={{ backgroundColor: categoria.corFundo, color: categoria.cor }}>
          {categoria.label}
        </span>
      </td>
      <td>
        <span className={`agenda-equipe-status ${evento.concluido ? 'done' : 'pending'}`}>
          {evento.concluido ? 'Concluído' : 'Pendente'}
        </span>
      </td>
      <td>
        <div className="agenda-equipe-actions">
          {isManual && (
            <button
              type="button"
              onClick={() => onToggleComplete(evento.id)}
              title={evento.concluido ? 'Reabrir evento' : 'Marcar como concluído'}
            >
              {evento.concluido ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
            </button>
          )}
          <button type="button" onClick={() => onEdit(evento)} title={isManual ? 'Editar evento' : 'Abrir origem'}>
            {isManual ? <Pencil size={14} /> : <ExternalLink size={14} />}
          </button>
          {isManual && (
            <button type="button" className="danger" onClick={() => onDeleteRequest(evento)} title="Remover evento">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
