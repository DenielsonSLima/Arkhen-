import React from 'react';
import { CheckCircle2, Eye, Trash2 } from 'lucide-react';
import { formatDateBR } from '../../services/rotinasAtividadesService';
import { getPct } from './utils';
import type { TaskInspectorProps } from './types';
import { deleteOutlineBtnStyle, styles } from './styles';
import { EmptyState } from './EmptyState';
import { ProgressBar } from './ProgressBar';
import { TaskReviewActions } from '../TaskReviewActions';
import { hasCompletionEvidence } from '../../utils/completionEvidence';

export const TaskInspector: React.FC<TaskInspectorProps> = ({
  deleteTarefa,
  filteredTasks,
  selectedTask,
  setSelectedTaskId,
  toggleChecklist,
  updateTarefa,
  isSaving,
  saveError,
  authUserId,
  canManage,
  reviewTarefaAsync,
  reopenTarefaAsync,
}) => {
  const [completionEvidence, setCompletionEvidence] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  React.useEffect(() => {
    setCompletionEvidence(selectedTask?.justificativaConclusao || selectedTask?.evidencia || '');
    setValidationError('');
  }, [selectedTask?.id, selectedTask?.evidencia, selectedTask?.justificativaConclusao]);

  const toggleStep = (index: number, checked: boolean) => {
    if (!selectedTask) return;
    const finishesChecklist = checked && selectedTask.checklist.every((item, itemIndex) => (
      itemIndex === index ? true : item.concluida
    ));
    const proof = { justificativa: completionEvidence };
    if (finishesChecklist && !hasCompletionEvidence(proof)) {
      setValidationError('Informe evidência ou justificativa antes de concluir a última etapa.');
      return;
    }
    setValidationError('');
    toggleChecklist(selectedTask.id, index, checked, proof);
  };

  return (
  <div style={styles.inspectorGrid}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={36} color="var(--color-gold-primary)" />} text="Nenhuma atividade cadastrada para este colaborador neste período." />
      ) : (
        filteredTasks.map((tarefa) => {
          const done = tarefa.checklist.filter((item) => item.concluida).length;
          const total = tarefa.checklist.length;
          const pct = getPct(done, total);
          return (
            <article
              key={tarefa.id}
              style={{
                ...styles.taskCard,
                borderColor: selectedTask?.id === tarefa.id ? 'rgba(197, 146, 53, 0.75)' : '#e2e8f0',
                boxShadow: selectedTask?.id === tarefa.id ? '0 0 0 3px rgba(197, 146, 53, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{tarefa.titulo}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {tarefa.cliente} • {formatDateBR(tarefa.vencimento)} • {tarefa.categoria}
                  </span>
                </div>
                <button onClick={() => setSelectedTaskId(tarefa.id)} style={styles.openBtn} title="Abrir acompanhamento" type="button">
                  <Eye size={14} />
                  Abrir
                </button>
              </div>
              <ProgressBar value={pct} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{done}/{total || 1} itens feitos</span>
                <span style={styles.statusSelect}>{tarefa.status}</span>
              </div>
            </article>
          );
        })
      )}
    </div>

    <aside style={styles.detailPanel}>
      {selectedTask ? (
        <>
          <div>
            <span style={styles.detailEyebrow}>Acompanhamento da tarefa</span>
            <h3 style={styles.detailTitle}>{selectedTask.titulo}</h3>
            <p style={styles.detailMeta}>{selectedTask.cliente} • {selectedTask.responsavel} • {formatDateBR(selectedTask.vencimento)}</p>
          </div>
          <div style={styles.detailSplit}>
            <div>
              <strong style={styles.detailSectionLabel}>Feito</strong>
              <div style={styles.detailChecklist}>
                {selectedTask.checklist.filter((item) => item.concluida).map((item) => (
                  <span key={item.titulo}>✓ {item.titulo}</span>
                ))}
                {selectedTask.checklist.every((item) => !item.concluida) && <em>Nada concluído ainda.</em>}
              </div>
            </div>
            <div>
              <strong style={styles.detailSectionLabel}>Falta</strong>
              <div style={styles.detailChecklist}>
                {selectedTask.checklist.filter((item) => !item.concluida).map((item, index) => (
                  <label key={item.titulo}>
                    <input
                      type="checkbox"
                      checked={item.concluida}
                      disabled={isSaving || selectedTask.status === 'Aguardando revisão' || selectedTask.status === 'Concluída'}
                      onChange={(event) => {
                        const realIndex = selectedTask.checklist.findIndex((check) => check.titulo === item.titulo);
                        toggleStep(realIndex >= 0 ? realIndex : index, event.target.checked);
                      }}
                      style={{ accentColor: 'var(--color-gold-primary)' }}
                    />
                    <span>{item.titulo}</span>
                  </label>
                ))}
                {selectedTask.checklist.every((item) => item.concluida) && <em>Tudo concluído.</em>}
              </div>
            </div>
          </div>
          <div style={styles.notesGrid}>
            <label>
              Evidência ou justificativa da conclusão
              <textarea
                value={completionEvidence}
                disabled={isSaving || selectedTask.status === 'Aguardando revisão' || selectedTask.status === 'Concluída'}
                onChange={(event) => setCompletionEvidence(event.target.value)}
                onBlur={(event) => updateTarefa(selectedTask.id, {
                  justificativaConclusao: event.target.value,
                })}
                placeholder="Protocolo, documento conferido ou motivo auditável."
              />
            </label>
            <label>
              Anotações do andamento
              <textarea
                value={selectedTask.notas || ''}
                onChange={(event) => updateTarefa(selectedTask.id, { notas: event.target.value })}
                placeholder="O que foi feito, confirmação, protocolo, observação do responsável..."
              />
            </label>
            <label>
              Pendência / motivo de falta
              <textarea
                value={selectedTask.observacaoFalta || ''}
                onChange={(event) => updateTarefa(selectedTask.id, { observacaoFalta: event.target.value })}
                placeholder="O que impediu a conclusão, documento faltando, retorno do cliente..."
              />
            </label>
          </div>
          {validationError && <div role="alert" style={{ color: '#b91c1c' }}>{validationError}</div>}
          {saveError && <div role="alert" style={{ color: '#b91c1c' }}>{saveError.message}</div>}
          <TaskReviewActions
            task={selectedTask}
            authUserId={authUserId}
            canManage={canManage}
            isSaving={isSaving}
            onReview={reviewTarefaAsync}
            onReopen={reopenTarefaAsync}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={() => deleteTarefa(selectedTask.id)} style={deleteOutlineBtnStyle} type="button">
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </>
      ) : (
        <EmptyState icon={<Eye size={34} color="var(--color-gold-primary)" />} text="Clique em uma atividade para acompanhar o andamento." />
      )}
    </aside>
  </div>
  );
};
