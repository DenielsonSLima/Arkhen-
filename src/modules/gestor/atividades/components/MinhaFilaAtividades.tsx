import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Clock, Plus, UserRound, X } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { addDaysKey, formatDateBR, todayKey, type TarefaGestor } from '../services/rotinasAtividadesService';
import { ModalNovaTarefa } from './ModalNovaTarefa';

export type MinhaFilaFiltro = 'hoje' | 'semana' | 'mes' | 'atrasadas' | 'internas';

const FILTROS: Array<{ id: MinhaFilaFiltro; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'internas', label: 'Internas' },
];

const getUsuarioAtual = () => {
  const fallback = 'Usuario';
  if (typeof window === 'undefined') return fallback;
  try {
    const profileRaw = window.localStorage.getItem('gestor_user_profile');
    if (!profileRaw) return fallback;
    const profile = JSON.parse(profileRaw);
    return typeof profile?.nome === 'string' && profile.nome.trim().length > 0 ? profile.nome : fallback;
  } catch {
    return fallback;
  }
};

const getMonday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date.toISOString().split('T')[0];
};

const isDone = (tarefa: TarefaGestor) => tarefa.status === 'Concluída';
const isLate = (tarefa: TarefaGestor) => !isDone(tarefa) && tarefa.vencimento < todayKey();
const isBlocked = (tarefa: TarefaGestor) => Boolean(tarefa.bloqueada || tarefa.observacaoFalta);

const matchesFilter = (tarefa: TarefaGestor, filtro: MinhaFilaFiltro) => {
  const hoje = todayKey();
  if (filtro === 'hoje') return tarefa.vencimento === hoje;
  if (filtro === 'semana') {
    const monday = getMonday(hoje);
    const sunday = addDaysKey(monday, 6);
    return tarefa.vencimento >= monday && tarefa.vencimento <= sunday;
  }
  if (filtro === 'mes') return tarefa.vencimento.slice(0, 7) === hoje.slice(0, 7);
  if (filtro === 'atrasadas') return isLate(tarefa);
  return tarefa.categoria === 'Interna';
};

export const MinhaFilaAtividades: React.FC<{ initialFilter?: MinhaFilaFiltro }> = ({ initialFilter = 'hoje' }) => {
  const { tarefas, updateTarefa, saveTarefaAsync } = useAtividadesWorkspace();
  const [activeFilter, setActiveFilter] = useState<MinhaFilaFiltro>(initialFilter);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const usuarioLogado = getUsuarioAtual();

  const filteredTasks = useMemo(() => (
    tarefas
      .filter((tarefa) => matchesFilter(tarefa, activeFilter))
      .sort((a, b) => {
        if (isLate(a) !== isLate(b)) return isLate(a) ? -1 : 1;
        if (isBlocked(a) !== isBlocked(b)) return isBlocked(a) ? -1 : 1;
        return a.vencimento.localeCompare(b.vencimento);
      })
  ), [activeFilter, tarefas]);

  const selectedTask = useMemo(() => (
    filteredTasks.find((tarefa) => tarefa.id === selectedTaskId) || null
  ), [filteredTasks, selectedTaskId]);

  const counts = useMemo(() => FILTROS.reduce<Record<MinhaFilaFiltro, number>>((acc, filtro) => {
    acc[filtro.id] = tarefas.filter((tarefa) => matchesFilter(tarefa, filtro.id)).length;
    return acc;
  }, { hoje: 0, semana: 0, mes: 0, atrasadas: 0, internas: 0 }), [tarefas]);

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
                  {isLate(tarefa) && <span style={dangerChipStyle}>Atrasada</span>}
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
        <div style={drawerBackdropStyle} onClick={() => setSelectedTaskId(null)}>
          <aside style={drawerStyle} onClick={(event) => event.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div>
                <span style={drawerEyebrowStyle}>Detalhe da tarefa</span>
                <h3>{selectedTask.titulo}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTaskId(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={drawerMetaStyle}>
              <span><CalendarDays size={14} /> {formatDateBR(selectedTask.vencimento)}</span>
              <span><UserRound size={14} /> {selectedTask.responsavel || 'Sem responsável'}</span>
              <span><Clock size={14} /> {selectedTask.status}</span>
              {isBlocked(selectedTask) && <span><AlertTriangle size={14} /> Bloqueada ou com observação</span>}
            </div>

            <label style={fieldStyle}>
              Observações / bloqueio
              <textarea
                value={selectedTask.observacaoFalta || selectedTask.notas || ''}
                onChange={(event) => updateTarefa(selectedTask.id, { observacaoFalta: event.target.value })}
                rows={4}
                style={textareaStyle}
              />
            </label>

            <div style={checklistBoxStyle}>
              <strong>Checklist</strong>
              {selectedTask.checklist.length === 0 ? (
                <span style={{ color: '#64748b' }}>Nenhuma etapa cadastrada.</span>
              ) : selectedTask.checklist.map((item) => (
                <span key={item.titulo} style={{ color: item.concluida ? '#10b981' : '#334155' }}>
                  {item.concluida ? '✓' : '○'} {item.titulo}
                </span>
              ))}
            </div>
          </aside>
        </div>
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
const drawerBackdropStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(15, 23, 42, 0.24)',
  zIndex: 1200,
  display: 'flex',
  justifyContent: 'flex-end',
};
const drawerStyle = {
  width: 'min(520px, 100vw)',
  height: '100%',
  background: '#ffffff',
  borderLeft: '1px solid #e2e8f0',
  padding: '22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '18px',
  boxShadow: '-18px 0 44px rgba(15, 23, 42, 0.16)',
};
const drawerHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' };
const drawerEyebrowStyle = { color: '#c59235', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' as const };
const closeBtnStyle = { border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '7px', cursor: 'pointer' };
const drawerMetaStyle = { display: 'grid', gap: '8px', color: '#475569', fontSize: '0.84rem' };
const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: '7px', color: '#334155', fontWeight: 700 };
const textareaStyle = { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', resize: 'vertical' as const };
const checklistBoxStyle = { display: 'flex', flexDirection: 'column' as const, gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' };
