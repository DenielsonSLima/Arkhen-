import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { addDaysKey, formatDateBR, todayKey, toLocalDateKey, type TarefaGestor } from '../services/rotinasAtividadesService';
import { MinhaFilaEmptyState } from './MinhaFilaEmptyState';
import { MinhaFilaToolbar } from './MinhaFilaToolbar';
import {
  MINHA_FILA_FILTROS,
  tarefasDoUsuario,
  type MinhaFilaFiltro,
} from './minhaFilaFilters';
import { ModalNovaTarefa } from './ModalNovaTarefa';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import {
  blockChipStyle,
  checkBtnStyle,
  clearSearchBtnStyle,
  dangerChipStyle,
  dateInputStyle,
  dateLabelStyle,
  dateNavBtnStyle,
  dateNavContainerStyle,
  listStyle,
  metaGridStyle,
  pageStyle,
  personalContextStyle,
  searchIconStyle,
  searchInputStyle,
  searchWrapperStyle,
  subToolbarStyle,
  taskCardStyle,
  taskMainBtnStyle,
  taskTitleRowStyle,
  todayBtnStyle,
} from './MinhaFilaAtividades.styles';

const getMonday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return toLocalDateKey(date);
};

const isDone = (tarefa: TarefaGestor) => tarefa.status === 'Concluída';
const isLate = (tarefa: TarefaGestor, refDate: string = todayKey()) => !isDone(tarefa) && tarefa.vencimento < refDate;
const isBlocked = (tarefa: TarefaGestor) => Boolean(tarefa.bloqueada || tarefa.observacaoFalta);

const matchesFilter = (tarefa: TarefaGestor, filtro: MinhaFilaFiltro, refDate: string) => {
  if (filtro === 'hoje') return tarefa.vencimento === refDate;
  if (filtro === 'semana') {
    const monday = getMonday(refDate);
    const sunday = addDaysKey(monday, 6);
    return tarefa.vencimento >= monday && tarefa.vencimento <= sunday;
  }
  if (filtro === 'mes') return tarefa.vencimento.slice(0, 7) === refDate.slice(0, 7);
  if (filtro === 'atrasadas') return isLate(tarefa, todayKey());
  return tarefa.categoria === 'Interna';
};

const addMonthsKey = (dateKey: string, months: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return toLocalDateKey(date);
};

const getPeriodLabel = (filtro: MinhaFilaFiltro, refDate: string) => {
  if (filtro === 'hoje') {
    const date = new Date(`${refDate}T00:00:00`);
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatDateBR(refDate)}`;
  }
  if (filtro === 'semana') {
    const monday = getMonday(refDate);
    const sunday = addDaysKey(monday, 6);
    return `Semana de ${formatDateBR(monday)} a ${formatDateBR(sunday)}`;
  }
  if (filtro === 'mes') {
    const date = new Date(`${refDate}T00:00:00`);
    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  }
  return '';
};

interface MinhaFilaAtividadesProps {
  initialFilter?: MinhaFilaFiltro;
  onConfigureRotinas?: () => void;
}

export const MinhaFilaAtividades: React.FC<MinhaFilaAtividadesProps> = ({
  initialFilter = 'hoje',
  onConfigureRotinas,
}) => {
  const {
    tarefas,
    authUserId,
    usuarioAtual,
    updateTarefa,
    saveTarefaAsync,
    toggleChecklist,
    isLoading,
    isWorkspaceError,
    reloadWorkspace,
  } = useAtividadesWorkspace();
  const [activeFilter, setActiveFilter] = useState<MinhaFilaFiltro>(initialFilter);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [referenceDate, setReferenceDate] = useState(todayKey());
  const usuarioLogado = usuarioAtual?.nome || 'Usuário';
  const personalTasks = useMemo(
    () => tarefasDoUsuario(tarefas, authUserId, usuarioAtual),
    [authUserId, tarefas, usuarioAtual],
  );

  const handlePrevPeriod = () => {
    if (activeFilter === 'hoje') {
      setReferenceDate(prev => addDaysKey(prev, -1));
    } else if (activeFilter === 'semana') {
      setReferenceDate(prev => addDaysKey(prev, -7));
    } else if (activeFilter === 'mes') {
      setReferenceDate(prev => addMonthsKey(prev, -1));
    }
  };

  const handleNextPeriod = () => {
    if (activeFilter === 'hoje') {
      setReferenceDate(prev => addDaysKey(prev, 1));
    } else if (activeFilter === 'semana') {
      setReferenceDate(prev => addDaysKey(prev, 7));
    } else if (activeFilter === 'mes') {
      setReferenceDate(prev => addMonthsKey(prev, 1));
    }
  };

  // Se o filtro mudar, sincroniza ou reseta datas adequadas se necessário
  const counts = useMemo(() => MINHA_FILA_FILTROS.reduce<Record<MinhaFilaFiltro, number>>((acc, filtro) => {
    acc[filtro.id] = personalTasks.filter((tarefa) => matchesFilter(tarefa, filtro.id, referenceDate)).length;
    return acc;
  }, { hoje: 0, semana: 0, mes: 0, atrasadas: 0, internas: 0 }), [personalTasks, referenceDate]);

  const filteredTasks = useMemo(() => (
    personalTasks
      .filter((tarefa) => {
        const matchesDate = matchesFilter(tarefa, activeFilter, referenceDate);
        if (!matchesDate) return false;

        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchesTitle = (tarefa.titulo || '').toLowerCase().includes(term);
          const matchesClient = (tarefa.cliente || '').toLowerCase().includes(term);
          const matchesResp = (tarefa.responsavel || '').toLowerCase().includes(term);
          return matchesTitle || matchesClient || matchesResp;
        }

        return true;
      })
      .sort((a, b) => {
        if (isLate(a, todayKey()) !== isLate(b, todayKey())) return isLate(a, todayKey()) ? -1 : 1;
        if (isBlocked(a) !== isBlocked(b)) return isBlocked(a) ? -1 : 1;
        return a.vencimento.localeCompare(b.vencimento);
      })
  ), [activeFilter, personalTasks, referenceDate, searchTerm]);

  const selectedTask = useMemo(() => (
    personalTasks.find((tarefa) => tarefa.id === selectedTaskId) || null
  ), [personalTasks, selectedTaskId]);

  const showFeedback = (texto: string, tipo: 'sucesso' | 'erro') => {
    setFeedback({ texto, tipo });
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleConcluir = (tarefa: TarefaGestor) => {
    updateTarefa(tarefa.id, {
      status: isDone(tarefa) ? 'Pendente' : 'Concluída',
      dataHoraConclusao: isDone(tarefa) ? undefined : new Date().toISOString(),
    });
  };

  const handleSalvarTarefaUsuario = (dados: any) => {
    const nova: TarefaGestor = {
      ...dados,
      id: `task-usuario-${Date.now()}`,
      frequencia: 'Única',
      responsavel: usuarioLogado,
      responsavelUserId: usuarioAtual?.userId,
      responsavelConfigUsuarioId: usuarioAtual?.configUsuarioId,
      cliente: dados.cliente || 'Escritório',
      origem: 'Usuario',
      status: 'Pendente',
      checklist: dados.checklist.map((item: string) => ({ titulo: item, concluida: false })),
    };

    saveTarefaAsync(nova)
      .then(() => {
        showFeedback('Tarefa criada com sucesso.', 'sucesso');
        setModalNovaAberto(false);
      })
      .catch(() => showFeedback('Não foi possível salvar a tarefa. Tente novamente.', 'erro'));
  };

  if (isLoading) {
    return <MinhaFilaEmptyState kind="loading" />;
  }

  if (isWorkspaceError) {
    return <MinhaFilaEmptyState kind="error" onRetry={() => void reloadWorkspace()} />;
  }

  if (!authUserId) {
    return <MinhaFilaEmptyState kind="session" onRetry={() => void reloadWorkspace()} />;
  }

  if (!usuarioAtual) {
    return <MinhaFilaEmptyState kind="unlinked" />;
  }

  return (
    <div style={pageStyle}>
      <div style={personalContextStyle} role="status">
        Exibindo somente tarefas atribuídas a <strong>{usuarioAtual.nome}</strong>.
      </div>
      <MinhaFilaToolbar
        activeFilter={activeFilter}
        counts={counts}
        onFilterChange={setActiveFilter}
        onCreateTask={() => setModalNovaAberto(true)}
      />

      {/* Barra de Filtros de Busca e Navegação de Data */}
      <section style={subToolbarStyle}>
        {/* Input de Busca */}
        <div style={searchWrapperStyle}>
          <Search size={16} color="#64748b" style={searchIconStyle} />
          <input
            type="text"
            placeholder="Buscar por título, cliente ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInputStyle}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={clearSearchBtnStyle}
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Navegação de Datas para Hoje, Semana, Mês */}
        {['hoje', 'semana', 'mes'].includes(activeFilter) && (
          <div style={dateNavContainerStyle}>
            <button
              type="button"
              onClick={handlePrevPeriod}
              style={dateNavBtnStyle}
              title="Período Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={dateLabelStyle}>
              {getPeriodLabel(activeFilter, referenceDate)}
            </span>
            <button
              type="button"
              onClick={handleNextPeriod}
              style={dateNavBtnStyle}
              title="Próximo Período"
            >
              <ChevronRight size={16} />
            </button>

            {/* Input Date Picker */}
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => {
                if (e.target.value) setReferenceDate(e.target.value);
              }}
              style={dateInputStyle}
            />

            {/* Reset to Today button */}
            {referenceDate !== todayKey() && (
              <button
                type="button"
                onClick={() => setReferenceDate(todayKey())}
                style={todayBtnStyle}
              >
                Voltar para Hoje
              </button>
            )}
          </div>
        )}
      </section>

      {feedback && (
        <div style={{ color: feedback.tipo === 'sucesso' ? '#166534' : '#b91c1c', fontWeight: 700 }}>
          {feedback.texto}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <MinhaFilaEmptyState
          kind={personalTasks.length === 0
            ? tarefas.length === 0 ? 'company-empty' : 'no-assignment'
            : 'no-results'}
          onConfigureRotinas={onConfigureRotinas}
        />
      ) : (
        <div style={listStyle}>
          {filteredTasks.map((tarefa) => (
            <article key={tarefa.id} style={taskCardStyle}>
              <button type="button" onClick={() => handleToggleConcluir(tarefa)} style={checkBtnStyle}>
                {isDone(tarefa) ? <CheckCircle2 size={19} color="#10b981" /> : <Circle size={19} color="#c59235" />}
              </button>

              <button type="button" onClick={() => setSelectedTaskId(tarefa.id)} style={taskMainBtnStyle}>
                <div style={taskTitleRowStyle}>
                  <strong>{tarefa.titulo}</strong>
                  {isLate(tarefa, todayKey()) && <span style={dangerChipStyle}>Atrasada</span>}
                  {isBlocked(tarefa) && <span style={blockChipStyle}>Bloqueio</span>}
                </div>
                <div style={metaGridStyle}>
                  <span>{tarefa.cliente || 'Escritório'}</span>
                  <span>{tarefa.frequencia}</span>
                  <span>Prazo: {formatDateBR(tarefa.vencimento)}</span>
                  <span>{tarefa.responsavel || 'Sem responsável'}</span>
                  <span>{tarefa.prioridade}</span>
                  <span>{tarefa.status}</span>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailsDrawer
          selectedTask={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          updateTarefa={updateTarefa}
          toggleChecklist={toggleChecklist}
        />
      )}

      <ModalNovaTarefa
        aberto={modalNovaAberto}
        onClose={() => setModalNovaAberto(false)}
        onSalvar={handleSalvarTarefaUsuario}
        usuarioNome={usuarioLogado}
      />
    </div>
  );
};
