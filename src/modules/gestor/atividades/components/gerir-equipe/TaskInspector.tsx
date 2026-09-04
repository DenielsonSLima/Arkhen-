import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileCheck2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useTarefaChecklistAudit } from '../../hooks/useTarefaChecklistAudit';
import { formatDateBR } from '../../services/rotinasAtividadesService';
import { formatPersistedCompletionDateTime } from '../../utils/minhaFilaPresentation';
import type { TaskInspectorProps } from './types';
import { deleteOutlineBtnStyle, styles } from './styles';
import { EmptyState } from './EmptyState';
import { ProgressBar } from './ProgressBar';

export const TaskInspector: React.FC<TaskInspectorProps> = ({
  filteredTasks,
  requestArchive,
  selectedTask,
  setSelectedTaskId,
  toggleChecklist,
  updateTarefa,
}) => {
  const checklistAudit = useTarefaChecklistAudit(selectedTask?.id || null);

  return (
    <div style={styles.inspectorGrid}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={36} color="var(--color-gold-primary)" />} text="Nenhuma atividade cadastrada para este colaborador neste período." />
      ) : (
        filteredTasks.map((tarefa) => {
          const done = tarefa.etapasConcluidas || 0;
          const total = tarefa.etapasTotal || tarefa.checklist.length;
          const pct = tarefa.percentual || 0;
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
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {tarefa.nivelRisco && tarefa.nivelRisco !== 'baixo' && tarefa.nivelRisco !== 'concluido' && (
                    <span style={riskBadgeStyle(tarefa.nivelRisco)}>
                      {tarefa.nivelRisco === 'critico' ? 'Crítico' : tarefa.nivelRisco === 'alto' ? 'Alto risco' : 'Atenção'}
                    </span>
                  )}
                  <span style={{ ...styles.statusSelect, cursor: 'default' }} title="O status é atualizado pelas etapas do checklist">
                    {tarefa.status}
                  </span>
                </div>
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
            <span style={styles.detailEyebrow}>Fiscalização da tarefa</span>
            <h3 style={styles.detailTitle}>{selectedTask.titulo}</h3>
            <p style={styles.detailMeta}>{selectedTask.cliente} • {selectedTask.responsavel} • {formatDateBR(selectedTask.vencimento)}</p>
          </div>
          <div style={riskPanelStyle}>
            <div>
              <span style={riskLabelStyle}><CalendarClock size={14} /> Prazo interno</span>
              <strong>{formatDateBR(selectedTask.prazoInterno || selectedTask.vencimento)}</strong>
            </div>
            <div>
              <span style={riskLabelStyle}><CalendarClock size={14} /> Prazo legal</span>
              <strong>{formatDateBR(selectedTask.prazoLegal || selectedTask.vencimento)}</strong>
            </div>
            <div>
              <span style={riskLabelStyle}><ShieldAlert size={14} /> Risco</span>
              <strong style={{ color: selectedTask.nivelRisco === 'critico' || selectedTask.nivelRisco === 'alto' ? '#b91c1c' : '#475569' }}>
                {selectedTask.nivelRisco === 'critico' ? 'Crítico' : selectedTask.nivelRisco === 'alto' ? 'Alto' : selectedTask.nivelRisco === 'medio' ? 'Atenção' : 'Baixo'}
              </strong>
            </div>
          </div>
          <div style={signalsStyle}>
            {selectedTask.diasEmAtraso ? (
              <span><AlertTriangle size={13} /> {selectedTask.diasEmAtraso} dia(s) em atraso</span>
            ) : selectedTask.diasParaVencimento === 0 ? (
              <span>Vence hoje</span>
            ) : null}
            {selectedTask.pendenciaRegistrada && <span>Pendência registrada</span>}
            {selectedTask.evidenciaRegistrada && <span><FileCheck2 size={13} /> Evidência registrada</span>}
            {selectedTask.revisaoPendente && <span>Aguardando revisão</span>}
          </div>
          <div style={styles.detailSplit}>
            <div>
              <strong style={styles.detailSectionLabel}>Feito</strong>
              <div style={styles.detailChecklist}>
                {selectedTask.checklist.map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.concluida)
                  .map(({ item, index }) => {
                    const completedAudit = checklistAudit.latestByStep.get(index);
                    const completedAt = completedAudit?.completed
                      ? formatPersistedCompletionDateTime(completedAudit.createdAt)
                      : null;

                    return (
                      <div key={`${index}-${item.titulo}`} style={completedItemStyle}>
                        <span>✓ {item.titulo}</span>
                        <span style={completionDateStyle}>
                          {completedAt && completedAudit ? (
                            <>
                              Feito em <time dateTime={completedAudit.createdAt}>{completedAt}</time>
                            </>
                          ) : checklistAudit.isLoading ? (
                            'Carregando data e hora...'
                          ) : checklistAudit.isError ? (
                            'Data e hora indisponíveis.'
                          ) : (
                            'Data e hora não registradas.'
                          )}
                        </span>
                      </div>
                    );
                  })}
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
                      onChange={(event) => {
                        const realIndex = selectedTask.checklist.findIndex((check) => check.titulo === item.titulo);
                        toggleChecklist(selectedTask.id, realIndex >= 0 ? realIndex : index, event.target.checked);
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
            <label style={styles.notesField}>
              Anotações do andamento
              <textarea
                value={selectedTask.notas || ''}
                onChange={(event) => updateTarefa(selectedTask.id, { notas: event.target.value })}
                placeholder="O que foi feito, confirmação, protocolo, observação do responsável..."
                rows={4}
                style={styles.notesTextarea}
              />
            </label>
            <label style={styles.notesField}>
              Pendência / motivo de falta
              <textarea
                value={selectedTask.observacaoFalta || ''}
                onChange={(event) => updateTarefa(selectedTask.id, { observacaoFalta: event.target.value })}
                placeholder="O que impediu a conclusão, documento faltando, retorno do cliente..."
                rows={4}
                style={styles.notesTextarea}
              />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={() => requestArchive(selectedTask)} style={deleteOutlineBtnStyle} type="button">
              <Trash2 size={14} /> Arquivar
            </button>
          </div>
        </>
      ) : (
        <EmptyState icon={<Eye size={34} color="var(--color-gold-primary)" />} text="Clique em uma atividade para fiscalizar o andamento." />
      )}
    </aside>
    </div>
  );
};

const completedItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const completionDateStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.68rem',
  fontWeight: 600,
  paddingLeft: '14px',
};

const riskBadgeStyle = (level: string): React.CSSProperties => ({
  borderRadius: '999px',
  padding: '4px 7px',
  background: level === 'critico' || level === 'alto' ? '#fee2e2' : '#fef3c7',
  color: level === 'critico' || level === 'alto' ? '#b91c1c' : '#a16207',
  fontSize: '0.66rem',
  fontWeight: 800,
});

const riskPanelStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '8px',
  padding: '12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#f8fafc',
};

const riskLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  marginBottom: '4px',
  color: '#64748b',
  fontSize: '0.67rem',
  fontWeight: 700,
  textTransform: 'uppercase',
};

const signalsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  color: '#9a3412',
  fontSize: '0.7rem',
  fontWeight: 700,
};
