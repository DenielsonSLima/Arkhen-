import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { addDaysKey, formatDateBR, todayKey, type TarefaGestor } from '../services/rotinasAtividadesService';
import { ModalNovaTarefa } from './ModalNovaTarefa';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';

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
  return date.toISOString().split('T')[0];
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
  const { tarefas, usuarioAtual, updateTarefa, saveTarefaAsync, toggleChecklist } = useAtividadesWorkspace();
  const [activeFilter, setActiveFilter] = useState<MinhaFilaFiltro>(initialFilter);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [referenceDate, setReferenceDate] = useState(todayKey());
  const usuarioLogado = usuarioAtual?.nome || 'Usuário';

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
    acc[filtro.id] = tarefas.filter((tarefa) => matchesFilter(tarefa, filtro.id, referenceDate)).length;
    return acc;
  }, { hoje: 0, semana: 0, mes: 0, atrasadas: 0, internas: 0 }), [tarefas, referenceDate]);

  const filteredTasks = useMemo(() => (
    tarefas
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
  ), [activeFilter, referenceDate, searchTerm, tarefas]);

  const selectedTask = useMemo(() => (
    tarefas.find((tarefa) => tarefa.id === selectedTaskId) || null
  ), [tarefas, selectedTaskId]);

  const showFeedback = (texto: string, tipo: 'sucesso' | 'erro') => {
    setFeedback({ texto, tipo });
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleConcluir = (tarefa: TarefaGestor) => {
    updateTarefa(tarefa.id, {
      status: isDone(tarefa) ? 'Pendente' : 'Concluída',
      dataHoraConclusao: isDone(tarefa) ? undefined : new Date().toLocaleString('pt-BR'),
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

  return (
    <div style={pageStyle}>
      <section style={toolbarStyle}>
        <div style={filterGroupStyle}>
          {FILTROS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              onClick={() => setActiveFilter(filtro.id)}
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
            placeholder="Buscar por título, cliente ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInputStyle}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} style={clearSearchBtnStyle}>
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
        <div className="empty-state-card" style={emptyStateStyle}>
          <CheckCircle2 size={38} color="var(--color-gold-primary)" />
          <p>Nenhuma tarefa encontrada para este filtro.</p>
        </div>
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
const listStyle = { display: 'flex', flexDirection: 'column' as const, gap: '10px' };
const taskCardStyle = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr',
  gap: '10px',
  alignItems: 'start',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px',
};
const checkBtnStyle = { border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' };
const taskMainBtnStyle = { border: 'none', background: 'transparent', textAlign: 'left' as const, cursor: 'pointer', padding: 0 };
const taskTitleRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, color: '#0f172a' };
const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '4px 12px',
  marginTop: '7px',
  color: '#64748b',
  fontSize: '0.76rem',
};
const chipBaseStyle = { borderRadius: '999px', padding: '2px 7px', fontSize: '0.66rem', fontWeight: 800 };
const dangerChipStyle = { ...chipBaseStyle, background: '#fee2e2', color: '#b91c1c' };
const blockChipStyle = { ...chipBaseStyle, background: '#fff7ed', color: '#c2410c' };

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
