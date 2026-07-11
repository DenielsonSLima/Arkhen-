import React from 'react';
import { AlertTriangle, CalendarRange, ClipboardCheck, ClipboardList } from 'lucide-react';
import type { TaskSummary } from './types';
import { styles } from './styles';

interface TaskSummaryCardsProps {
  summary: TaskSummary;
}

export const TaskSummaryCards: React.FC<TaskSummaryCardsProps> = ({ summary }) => (
  <div style={styles.summaryGrid}>
    <div style={styles.summaryCard}><ClipboardList size={16} /><span>Total</span><strong>{summary.total}</strong></div>
    <div style={styles.summaryCard}><ClipboardCheck size={16} /><span>Concluídas</span><strong>{summary.done}</strong></div>
    <div style={styles.summaryCard}><CalendarRange size={16} /><span>Andamento</span><strong>{summary.progress}</strong></div>
    <div style={styles.summaryCard}><AlertTriangle size={16} /><span>Atrasadas</span><strong>{summary.late}</strong></div>
  </div>
);
