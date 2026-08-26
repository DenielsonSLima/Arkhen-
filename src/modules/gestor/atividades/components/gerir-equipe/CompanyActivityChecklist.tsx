import React, { useState } from 'react';
import type { CompanyActivity } from '../../hooks/useAtividades';
import {
  hasCompletionEvidence,
  isFinalChecklistTransition,
  type CompletionEvidence,
} from '../../utils/completionEvidence';
import { styles } from './styles';

interface CompanyActivityChecklistProps {
  activity: CompanyActivity;
  onToggle?: (
    taskId: string,
    step: string,
    checked: boolean,
    proof?: CompletionEvidence,
  ) => Promise<void>;
}

export const CompanyActivityChecklist: React.FC<CompanyActivityChecklistProps> = ({
  activity,
  onToggle,
}) => {
  const [proofText, setProofText] = useState(
    activity.justificativaConclusao || activity.evidencia || '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = async (step: string, checked: boolean) => {
    const proof = { justificativa: proofText };
    if (isFinalChecklistTransition(activity.checklists, step, checked)
        && !hasCompletionEvidence(proof)) {
      setError('Informe evidência ou justificativa antes da última etapa.');
      return;
    }
    if (!onToggle) return;
    setSaving(true);
    setError('');
    try {
      await onToggle(activity.instanciaId, step, checked, proof);
    } catch (operationError) {
      setError(operationError instanceof Error
        ? operationError.message
        : 'Não foi possível atualizar o checklist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <label style={{ display: 'grid', gap: '5px', fontSize: '0.76rem', fontWeight: 700 }}>
        Evidência ou justificativa da conclusão
        <textarea
          value={proofText}
          onChange={(event) => setProofText(event.target.value)}
          disabled={saving || activity.status === 'Aguardando revisão' || activity.status === 'Concluída'}
          rows={2}
          placeholder="Protocolo, documento conferido ou motivo auditável."
        />
      </label>
      {error && <div role="alert" style={{ color: '#b91c1c', fontSize: '0.76rem' }}>{error}</div>}
      <div style={styles.detailChecklist}>
        {Object.keys(activity.checklists).map((step) => (
          <label key={step}>
            <input
              type="checkbox"
              checked={activity.checklists[step]}
              disabled={!onToggle || saving || activity.status === 'Aguardando revisão' || activity.status === 'Concluída'}
              onChange={(event) => void toggle(step, event.target.checked)}
              style={{ accentColor: 'var(--color-gold-primary)' }}
            />
            <span>{activity.checklistLabels?.[step] || step}</span>
          </label>
        ))}
      </div>
    </>
  );
};
