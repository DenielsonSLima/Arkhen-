import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, Clock, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { formatDateBR, todayKey, addDaysKey, type TarefaGestor } from '../services/rotinasAtividadesService';
import { ModalNovaTarefa } from './ModalNovaTarefa';

interface AbaMinhasAtividadesProps {
  initialPeriodo?: 'dia' | 'semana' | 'mes';
  showInternasOnly?: boolean;
}

export const AbaMinhasAtividades: React.FC<AbaMinhasAtividadesProps> = ({
  initialPeriodo = 'semana',
  showInternasOnly = false,
}) => {
  const { tarefas, updateTarefa, toggleChecklist, saveTarefa, deleteTarefa } = useAtividadesWorkspace();
  const [dataBase, setDataBase] = useState(todayKey());
  const [modalNovaAberto, setModalNovaAberto] = useState(false);

  const getMonday = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
    return date.toISOString().split('T')[0];
  };

  const shiftDate = (amount: number) => {
    if (initialPeriodo === 'dia') setDataBase(addDaysKey(dataBase, amount));
    else if (initialPeriodo === 'semana') setDataBase(addDaysKey(dataBase, amount * 7));
    else {
      const d = new Date(`${dataBase}T00:00:00`);
      d.setMonth(d.getMonth() + amount);
      setDataBase(d.toISOString().split('T')[0]);
    }
  };

  const isTaskInPeriod = (task: TarefaGestor) => {
    if (initialPeriodo === 'dia') return task.vencimento === dataBase;
    if (initialPeriodo === 'semana') {
      const monday = getMonday(dataBase);
      const sunday = addDaysKey(monday, 6);
      return task.vencimento >= monday && task.vencimento <= sunday;
    }
    return task.vencimento.slice(0, 7) === dataBase.slice(0, 7);
  };

  const minhasTarefas = useMemo(() => {
    return tarefas
      .filter((t) => {
        if (showInternasOnly && t.categoria !== 'Interna') return false;
        return isTaskInPeriod(t);
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [tarefas, initialPeriodo, dataBase, showInternasOnly]);

  const handleToggleConcluir = (tarefa: TarefaGestor) => {
    const isDone = tarefa.status === 'Concluída';
    updateTarefa(tarefa.id, {
      status: isDone ? 'Pendente' : 'Concluída',
      dataHoraConclusao: isDone ? undefined : new Date().toLocaleString('pt-BR'),
    });
  };

  const handleSalvarTarefaUsuario = (dados: any) => {
    const nova: TarefaGestor = {
      ...dados,
      id: `task-usuario-${Date.now()}`,
      responsavel: '',
      cliente: 'Escritório',
      origem: 'Usuario',
      status: 'Pendente',
      checklist: dados.checklist.map((item: string) => ({ titulo: item, concluida: false })),
    };
    saveTarefa(nova);
    setModalNovaAberto(false);
  };

  const getStatusBadge = (tarefa: TarefaGestor) => {
    if (tarefa.status === 'Concluída') {
      return (
        <span style={{ ...badgeStyle, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
          Concluída
        </span>
      );
    }
    if (tarefa.vencimento < todayKey()) {
      return (
        <span style={{ ...badgeStyle, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
          Atrasada
        </span>
      );
    }
    return (
      <span style={{ ...badgeStyle, backgroundColor: 'rgba(197, 146, 53, 0.1)', color: 'var(--color-gold-dark)' }}>
        Pendente
      </span>
    );
  };

  // Cálculo da régua de 5 períodos
  const timelineItems = useMemo(() => {
    if (initialPeriodo === 'dia') {
      return [-2, -1, 0, 1, 2].map((offset) => addDaysKey(dataBase, offset));
    } else if (initialPeriodo === 'semana') {
      const monday = getMonday(dataBase);
      return [-2, -1, 0, 1, 2].map((offset) => addDaysKey(monday, offset * 7));
    } else {
      return [-2, -1, 0, 1, 2].map((offset) => {
        const d = new Date(`${dataBase}T00:00:00`);
        d.setMonth(d.getMonth() + offset);
        return d.toISOString().split('T')[0];
      });
    }
  }, [dataBase, initialPeriodo]);

  const getTimelineItemLabel = (val: string) => {
    const d = new Date(`${val}T00:00:00`);
    if (initialPeriodo === 'dia') {
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return `${dayNum}/${monthNum} (${weekdays[d.getDay()]})`;
    } else if (initialPeriodo === 'semana') {
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      return `Sem. de ${dayNum}/${monthNum}`;
    } else {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${months[d.getMonth()]}/${d.getFullYear()}`;
    }
  };

  const isTimelineItemActive = (val: string) => {
    if (initialPeriodo === 'dia') return val === dataBase;
    if (initialPeriodo === 'semana') return getMonday(val) === getMonday(dataBase);
    return val.slice(0, 7) === dataBase.slice(0, 7);
  };

  // Cálculo de progresso de um período específico para exibir na timeline
  const getPeriodProgress = (val: string) => {
    const periodTasks = tarefas.filter((t) => {
      if (showInternasOnly && t.categoria !== 'Interna') return false;

      if (initialPeriodo === 'dia') return t.vencimento === val;
      if (initialPeriodo === 'semana') {
        const monday = getMonday(val);
        const sunday = addDaysKey(monday, 6);
        return t.vencimento >= monday && t.vencimento <= sunday;
      }
      return t.vencimento.slice(0, 7) === val.slice(0, 7);
    });

    if (periodTasks.length === 0) return null;
    const completed = periodTasks.filter((t) => t.status === 'Concluída').length;
    return Math.round((completed / periodTasks.length) * 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 5-Period Timeline Toolbar & Progress Indicator */}
      <div style={timelineWrapperStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => shiftDate(-1)} style={timelineArrowBtnStyle} type="button">
            <ChevronLeft size={16} />
          </button>
          
          <div style={{ display: 'flex', gap: '6px' }}>
            {timelineItems.map((val) => {
              const active = isTimelineItemActive(val);
              const progress = getPeriodProgress(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDataBase(val)}
                  style={active ? activeTimelineItemStyle : inactiveTimelineItemStyle}
                >
                  {getTimelineItemLabel(val)}
                  {progress !== null && (
                    <span style={{
                      marginLeft: '6px',
                      backgroundColor: active ? 'rgba(255, 255, 255, 0.25)' : 'rgba(197, 146, 53, 0.12)',
                      color: active ? '#ffffff' : 'var(--color-gold-dark)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}>
                      {progress}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button onClick={() => shiftDate(1)} style={timelineArrowBtnStyle} type="button">
            <ChevronRight size={16} />
          </button>
        </div>

        <button onClick={() => setModalNovaAberto(true)} style={primaryBtnStyle} type="button">
          <Plus size={15} /> Nova Atividade
        </button>
      </div>

      {minhasTarefas.length === 0 ? (
        <div className="empty-state-card" style={emptyCardStyle}>
          <CheckCircle2 size={40} color="var(--color-gold-primary)" />
          <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
            Nenhuma atividade atribuída para este período.
          </p>
        </div>
      ) : (
        <div style={gridContainerStyle}>
          {minhasTarefas.map((tarefa) => (
            <article key={tarefa.id} style={{
              ...cardStyle,
              borderColor: tarefa.status === 'Concluída' ? '#e2e8f0' : 'rgba(197, 146, 53, 0.25)',
              opacity: tarefa.status === 'Concluída' ? 0.8 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleConcluir(tarefa)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
                  >
                    {tarefa.status === 'Concluída' ? (
                      <CheckCircle2 size={20} color="#10b981" />
                    ) : (
                      <Circle size={20} color="var(--color-gold-primary)" />
                    )}
                  </button>
                  <div>
                    <h3 style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      textDecoration: tarefa.status === 'Concluída' ? 'line-through' : 'none',
                      color: tarefa.status === 'Concluída' ? '#94a3b8' : '#0f172a',
                      lineHeight: '1.3',
                    }}>
                      {tarefa.titulo}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      {tarefa.cliente} • Vence: {formatDateBR(tarefa.vencimento)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  {getStatusBadge(tarefa)}
                  {tarefa.origem === 'Usuario' && (
                    <button
                      onClick={() => deleteTarefa(tarefa.id)}
                      style={deleteBtnStyle}
                      title="Excluir minha atividade"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {tarefa.checklist && tarefa.checklist.length > 0 && (
                <div style={checklistContainerStyle}>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--color-gold-dark)', display: 'block', marginBottom: '6px' }}>
                    Etapas:
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tarefa.checklist.map((item, index) => (
                      <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <input
                          type="checkbox"
                          checked={item.concluida}
                          onChange={(e) => toggleChecklist(tarefa.id, index, e.target.checked)}
                          style={{ accentColor: 'var(--color-gold-primary)' }}
                        />
                        <span style={{ color: item.concluida ? '#94a3b8' : '#334155', textDecoration: item.concluida ? 'line-through' : 'none' }}>
                          {item.titulo}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={footerStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    Observações:
                  </label>
                  <textarea
                    value={tarefa.observacaoFalta || tarefa.notas || ''}
                    onChange={(e) => updateTarefa(tarefa.id, { observacaoFalta: e.target.value })}
                    placeholder="Anotações..."
                    style={textareaStyle}
                    rows={1}
                  />
                </div>
                {tarefa.dataHoraConclusao && (
                  <div style={timestampStyle}>
                    <Clock size={11} />
                    <span>Feito em {tarefa.dataHoraConclusao}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <ModalNovaTarefa
        aberto={modalNovaAberto}
        onClose={() => setModalNovaAberto(false)}
        onSalvar={handleSalvarTarefaUsuario}
        usuarioNome=""
      />
    </div>
  );
};

// Estilos Tema Claro
const gridContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
  gap: '16px',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.02)',
  justifyContent: 'space-between',
};

const badgeStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const checklistContainerStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '10px',
};

const footerStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px',
  borderTop: '1px solid #e2e8f0',
  paddingTop: '10px',
  marginTop: 'auto',
};

const textareaStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  padding: '5px 8px',
  color: '#0f172a',
  fontSize: '0.78rem',
  outline: 'none',
  resize: 'none' as const,
  width: '100%',
};

const timestampStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.68rem',
  color: '#10b981',
  backgroundColor: 'rgba(16, 185, 129, 0.08)',
  padding: '3px 6px',
  borderRadius: '4px',
  fontWeight: 500,
  alignSelf: 'flex-start',
};

const emptyCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px dashed #cbd5e1',
  borderRadius: '8px',
  padding: '40px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
};

const timelineWrapperStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px 16px',
  flexWrap: 'wrap' as const,
  gap: '12px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.015)',
};

const timelineArrowBtnStyle = {
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#0f172a',
  cursor: 'pointer',
};

const activeTimelineItemStyle = {
  backgroundColor: 'var(--color-gold-primary)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '0.78rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(197, 146, 53, 0.2)',
  display: 'flex',
  alignItems: 'center',
};

const inactiveTimelineItemStyle = {
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '0.78rem',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const deleteBtnStyle = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
};

const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 14px',
  color: '#ffffff',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  boxShadow: '0 2px 6px rgba(197, 146, 53, 0.2)',
};
