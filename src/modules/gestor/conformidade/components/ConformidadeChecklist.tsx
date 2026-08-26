import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import {
  hasCompletionEvidence,
  isFinalChecklistTransition,
  type CompletionEvidence,
} from '../../atividades/utils/completionEvidence';
import type { ConformidadeObrigacao } from '../services/conformidadeOperationalService';

interface ConformidadeChecklistProps {
  item: ConformidadeObrigacao;
  isUpdating: boolean;
  formatDate: (value: string) => string;
  onToggle: (
    obrigacaoId: string,
    etapaId: string,
    checked: boolean,
    proof?: CompletionEvidence,
  ) => Promise<void>;
}

export const ConformidadeChecklist: React.FC<ConformidadeChecklistProps> = ({
  item,
  isUpdating,
  formatDate,
  onToggle,
}) => {
  const [completionEvidence, setCompletionEvidence] = useState(
    item.justificativaConclusao || item.evidencia || '',
  );
  const [validationError, setValidationError] = useState('');
  const checklist = useMemo(() => Object.fromEntries(
    item.etapas.map((step) => [step.id, step.concluida]),
  ), [item.etapas]);

  const toggleStep = async (stepId: string, checked: boolean) => {
    const proof = { justificativa: completionEvidence };
    if (isFinalChecklistTransition(checklist, stepId, checked)
        && !hasCompletionEvidence(proof)) {
      setValidationError('Informe evidência ou justificativa antes de concluir a última etapa.');
      return;
    }
    setValidationError('');
    await onToggle(item.id, stepId, checked, proof);
  };

  return (
    <div className="conformidade-checklist">
      <h4>Checklist de competência</h4>
      {item.podeAtualizar && item.status !== 'Concluído' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', fontWeight: 700, color: '#334155' }}>
          Evidência ou justificativa da conclusão
          <textarea
            value={completionEvidence}
            onChange={(event) => setCompletionEvidence(event.target.value)}
            disabled={isUpdating}
            rows={3}
            placeholder="Informe protocolo, documento conferido ou motivo auditável."
            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', font: 'inherit', resize: 'vertical' }}
          />
        </label>
      )}
      {validationError && (
        <div role="alert" className="conformidade-data-scope" style={{ marginBottom: '10px' }}>
          {validationError}
        </div>
      )}
      <div className="conformidade-checklist-steps">
        {item.etapas.map((step) => (
          <label
            key={`${item.id}-${step.id}`}
            className={`conformidade-step-row ${step.concluida ? 'completed' : ''}`}
            title={item.podeAtualizar
              ? undefined
              : 'Seu perfil possui acesso somente para consulta desta atividade.'}
          >
            <input
              type="checkbox"
              checked={step.concluida}
              disabled={isUpdating || !item.podeAtualizar}
              onChange={(event) => void toggleStep(step.id, event.target.checked)}
            />
            <div>
              <strong>{step.label}</strong>
              <span>
                {step.concluida
                  ? `Concluído${step.responsavel ? ` por ${step.responsavel}` : ''}${step.concluidaEm ? ` • ${formatDate(step.concluidaEm)}` : ''}`
                  : 'Pendente'}
              </span>
            </div>
            {step.concluida ? <CheckCircle2 size={15} /> : <Clock size={15} />}
          </label>
        ))}
      </div>
    </div>
  );
};
