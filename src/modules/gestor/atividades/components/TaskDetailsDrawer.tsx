import React from 'react';
import { X } from 'lucide-react';
import { formatDateBR, type TarefaGestor } from '../services/rotinasAtividadesService';

interface TaskDetailsDrawerProps {
  selectedTask: TarefaGestor;
  onClose: () => void;
  updateTarefa: (id: string, updates: Partial<TarefaGestor>) => void;
  toggleChecklist: (id: string, idx: number, checked: boolean) => void;
}

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({
  selectedTask,
  onClose,
  updateTarefa,
  toggleChecklist,
}) => {
  const totalItems = selectedTask.checklist.length;
  const completedItems = selectedTask.checklist.filter((item) => item.concluida).length;
  const checklistPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div style={drawerBackdropStyle} onClick={onClose}>
      <aside style={drawerStyle} onClick={(event) => event.stopPropagation()}>
        
        {/* Back / Close button bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '8px',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <X size={14} /> Fechar Detalhes
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            <span>Fila de Tarefas</span>
            <span>/</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedTask.cliente || 'Escritório'}</span>
          </div>
        </div>

        {/* Premium Header Banner */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              flexShrink: 0,
            }}>
              {(selectedTask.cliente || 'E').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {selectedTask.titulo}
              </h3>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 800,
                  background: selectedTask.prioridade === 'Alta' ? '#fee2e2' : selectedTask.prioridade === 'Média' ? '#fff7ed' : '#f1f5f9',
                  color: selectedTask.prioridade === 'Alta' ? '#b91c1c' : selectedTask.prioridade === 'Média' ? '#c2410c' : '#475569',
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  {selectedTask.prioridade}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 800,
                  background: selectedTask.status === 'Concluída' ? '#d1fae5' : selectedTask.status === 'Em andamento' ? '#fef3c7' : '#f1f5f9',
                  color: selectedTask.status === 'Concluída' ? '#065f46' : selectedTask.status === 'Em andamento' ? '#92400e' : '#374151',
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  {selectedTask.status}
                </span>
              </div>
            </div>
          </div>

          {totalItems > 0 && (
            <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                <span>PROGRESSO DO CHECKLIST</span>
                <span style={{ color: 'var(--color-gold-dark, #aa7c28)' }}>{checklistPct}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${checklistPct}%`, height: '100%', background: 'linear-gradient(90deg, #c59235 0%, #aa7c28 100%)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Metadata Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px',
          fontSize: '0.8rem',
          color: '#475569',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Empresa / Cliente</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.cliente || 'Escritório'}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Prazo / Vencimento</span>
            <strong style={{ color: '#0f172a' }}>{formatDateBR(selectedTask.vencimento)}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Frequência</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.frequencia}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Responsável</span>
            <strong style={{ color: '#0f172a' }}>{selectedTask.responsavel || 'Sem responsável'}</strong>
          </div>
        </div>

        {/* Observações / Bloqueio Textarea */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
          Observações / bloqueio
          <textarea
            value={selectedTask.observacaoFalta || selectedTask.notas || ''}
            onChange={(event) => updateTarefa(selectedTask.id, { observacaoFalta: event.target.value })}
            rows={4}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '0.84rem',
              color: '#0f172a',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#c59235'}
            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
          />
        </label>

        {/* Checklist Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <strong style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Checklist de Etapas</strong>
          {selectedTask.checklist.length === 0 ? (
            <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Nenhuma etapa cadastrada.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedTask.checklist.map((item, idx) => {
                const isItemDone = item.concluida;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      gap: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: isItemDone ? '#f0fdf4' : '#ffffff',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <input
                        type="checkbox"
                        id={`step-${selectedTask.id}-${idx}`}
                        checked={isItemDone}
                        onChange={(e) => toggleChecklist(selectedTask.id, idx, e.target.checked)}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#c59235',
                          cursor: 'pointer',
                        }}
                      />
                      <label
                        htmlFor={`step-${selectedTask.id}-${idx}`}
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          color: '#0f172a',
                          cursor: 'pointer',
                          flex: 1,
                          textDecoration: isItemDone ? 'line-through' : 'none',
                          opacity: isItemDone ? 0.6 : 1,
                        }}
                      >
                        {item.titulo}
                      </label>
                    </div>
                    {isItemDone && (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#10b981',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#e6fbf1',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}>
                        ✓ Concluído
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

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
  overflowY: 'auto' as const,
};
