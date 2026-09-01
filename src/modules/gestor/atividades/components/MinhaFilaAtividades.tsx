import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import {
  addDaysKey,
  formatDateBR,
  todayKey,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';
import { getTarefasDoUsuarioAtual } from '../utils/minhaFila';
import { addMonthsKey, isTarefaAtrasada } from '../utils/minhaFilaPresentation';
import { ModalNovaTarefa } from './ModalNovaTarefa';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { MinhaFilaTaskCard } from './minha-fila/MinhaFilaTaskCard';

export type MinhaFilaFiltro = 'hoje' | 'semana' | 'mes' | 'atrasadas' | 'internas';

const FILTROS: Array<{ id: MinhaFilaFiltro; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'internas', label: 'Internas' },
];

const getMonday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date.toISOString().split('T')[0];
};

const isBlocked = (tarefa: TarefaGestor) => Boolean(tarefa.bloqueada || tarefa.observacaoFalta);

const matchesFilter = (tarefa: TarefaGestor, filtro: MinhaFilaFiltro, refDate: string) => {
  if (filtro === 'hoje') return tarefa.vencimento === refDate;
  if (filtro === 'semana') {
    const monday = getMonday(refDate);
    const sunday = addDaysKey(monday, 6);
    return tarefa.vencimento >= monday && tarefa.vencimento <= sunday;
  }
  if (filtro === 'mes') return tarefa.vencimento.slice(0, 7) === refDate.slice(0, 7);
  if (filtro === 'atrasadas') return isTarefaAtrasada(tarefa, todayKey());
  return tarefa.categoria === 'Interna';
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

export const MinhaFilaAtividades: React.FC<{ initialFilter?: MinhaFilaFiltro }> = ({ initialFilter = 'hoje' }) => {
  const {
    tarefas,
    usuarioAtual,
    updateTarefaAsync,
    saveTarefaAsync,
    toggleChecklistAsync,
  } = useAtividadesWorkspace();
  const [activeFilter, setActiveFilter] = useState<MinhaFilaFiltro>(initialFilter);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [referenceDate, setReferenceDate] = useState(todayKey());
  const usuarioLogado = usuarioAtual?.nome || 'Usuário';
  const minhasTarefas = useMemo(
    () => getTarefasDoUsuarioAtual(tarefas, usuarioAtual),
    [tarefas, usuarioAtual],
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
  const counts = useMemo(() => FILTROS.reduce<Record<MinhaFilaFiltro, number>>((acc, filtro) => {
    acc[filtro.id] = minhasTarefas.filter((tarefa) => matchesFilter(tarefa, filtro.id, referenceDate)).length;
    return acc;
  }, { hoje: 0, semana: 0, mes: 0, atrasadas: 0, internas: 0 }), [minhasTarefas, referenceDate]);

  const filteredTasks = useMemo(() => (
    minhasTarefas
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
        if (isTarefaAtrasada(a, todayKey()) !== isTarefaAtrasada(b, todayKey())) {
          return isTarefaAtrasada(a, todayKey()) ? -1 : 1;
        }
        if (isBlocked(a) !== isBlocked(b)) return isBlocked(a) ? -1 : 1;
        return a.vencimento.localeCompare(b.vencimento);
      })
  ), [activeFilter, minhasTarefas, referenceDate, searchTerm]);

  const selectedTask = useMemo(() => (
    minhasTarefas.find((tarefa) => tarefa.id === selectedTaskId) || null
  ), [minhasTarefas, selectedTaskId]);

  const showFeedback = (texto: string, tipo: 'sucesso' | 'erro') => {
    setFeedback({ texto, tipo });
    window.setTimeout(() => setFeedback(null), 3000);
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

  return (
    <div style={pageStyle}>
      <section style={toolbarStyle}>
        <div style={filterGroupStyle}>
          {FILTROS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              onClick={() => setActiveFilter(filtro.id)}
              aria-pressed={activeFilter === filtro.id}
              style={activeFilter === filtro.id ? activeFilterBtnStyle : filterBtnStyle}
            >
              {filtro.label}
              <strong>{counts[filtro.id]}</strong>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setModalNovaAberto(true)} style={primaryBtnStyle}>
          <Plus size={15} /> Nova tarefa
        </button>
      </section>

      {/* Barra de Filtros de Busca e Navegação de Data */}
      <section style={subToolbarStyle}>
        {/* Input de Busca */}
        <div style={searchWrapperStyle}>
          <Search size={16} color="#64748b" style={searchIconStyle} />
          <input
            type="text"
            aria-label="Buscar tarefas"
            placeholder="Buscar por título, cliente ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInputStyle}
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearchTerm('')}
              style={clearSearchBtnStyle}
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
              aria-label="Período anterior"
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
              aria-label="Próximo período"
              onClick={handleNextPeriod}
              style={dateNavBtnStyle}
              title="Próximo Período"
            >
              <ChevronRight size={16} />
            </button>

            {/* Input Date Picker */}
            <input
              type="date"
              aria-label="Selecionar data de referência"
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
        <div
          role={feedback.tipo === 'erro' ? 'alert' : 'status'}
          aria-live={feedback.tipo === 'erro' ? 'assertive' : 'polite'}
          style={{ color: feedback.tipo === 'sucesso' ? '#166534' : '#b91c1c', fontWeight: 700 }}
        >
          {feedback.texto}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state-card" style={emptyStateStyle}>
          <CheckCircle2 size={38} color="var(--color-gold-primary)" />
          <p>Nenhuma tarefa encontrada para este filtro.</p>
        </div>
      ) : (
        <section className="minha-fila-card-grid" aria-label="Tarefas da minha fila">
          {filteredTasks.map((tarefa) => (
            <MinhaFilaTaskCard
              key={tarefa.id}
              task={tarefa}
              isLate={isTarefaAtrasada(tarefa, todayKey())}
              isBlocked={isBlocked(tarefa)}
              onOpen={() => setSelectedTaskId(tarefa.id)}
            />
          ))}
        </section>
      )}

      {selectedTask && (
        <TaskDetailsDrawer
          selectedTask={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          updateTarefa={updateTarefaAsync}
          toggleChecklist={toggleChecklistAsync}
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

const pageStyle = { display: 'flex', flexDirection: 'column' as const, gap: '18px' };
const toolbarStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' as const };
const filterGroupStyle = { display: 'flex', gap: '8px', flexWrap: 'wrap' as const };
const filterBtnBaseStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '9px 12px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  fontWeight: 700,
  cursor: 'pointer',
};
const filterBtnStyle = { ...filterBtnBaseStyle, background: '#ffffff', color: '#64748b' };
const activeFilterBtnStyle = { ...filterBtnBaseStyle, background: '#1f2937', color: '#ffffff', borderColor: '#c59235' };
const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '8px',
  padding: '9px 14px',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const emptyStateStyle = { padding: '40px', textAlign: 'center' as const, color: '#64748b' };
// Sub-toolbar and search styles
const subToolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap' as const,
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '12px 16px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
};
const searchWrapperStyle = {
  position: 'relative' as const,
  flex: '1 1 300px',
  display: 'flex',
  alignItems: 'center',
};
const searchInputStyle = {
  width: '100%',
  padding: '9px 12px 9px 36px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.84rem',
  color: '#0f172a',
  outline: 'none',
  background: '#ffffff',
};
const searchIconStyle = {
  position: 'absolute' as const,
  left: '12px',
  pointerEvents: 'none' as const,
};
const clearSearchBtnStyle = {
  position: 'absolute' as const,
  right: '10px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const dateNavContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap' as const,
};
const dateNavBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  transition: 'all 0.18s ease',
};
const dateLabelStyle = {
  fontSize: '0.86rem',
  fontWeight: 700,
  color: '#0f172a',
  minWidth: '180px',
  textAlign: 'center' as const,
};
const dateInputStyle = {
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
  outline: 'none',
  background: '#ffffff',
};
const todayBtnStyle = {
  padding: '8px 12px',
  border: '1px solid rgba(197, 146, 53, 0.3)',
  borderRadius: '8px',
  background: 'rgba(197, 146, 53, 0.08)',
  color: '#aa7c28',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.18s ease',
};
