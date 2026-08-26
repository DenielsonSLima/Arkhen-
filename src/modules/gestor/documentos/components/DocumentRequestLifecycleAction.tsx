import React, { useState } from 'react';
import { FileCheck2, FileWarning, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useDocumentRequestOptions } from '../hooks/useDocumentRequests';
import type {
  DocumentRequest,
  DocumentRequestStatus,
  TransitionDocumentRequestInput,
} from '../services/documentRequestService';
import '../styles/DocumentRequestLifecycle.css';

interface DocumentRequestLifecycleActionProps {
  request: DocumentRequest;
  disabled: boolean;
  onTransition: (input: TransitionDocumentRequestInput) => Promise<void>;
}

const ACTION_LABELS: Record<DocumentRequestStatus, string> = {
  Pendente: 'Reabrir',
  Recebido: 'Registrar recebimento',
  'Em conferência': 'Iniciar conferência',
  Concluído: 'Concluir conferência',
  Cancelado: 'Cancelar solicitação',
};

const ActionIcon = ({ status }: { status: DocumentRequestStatus }) => {
  if (status === 'Pendente') return <RotateCcw size={14} aria-hidden />;
  if (status === 'Cancelado') return <XCircle size={14} aria-hidden />;
  return <FileCheck2 size={14} aria-hidden />;
};

export const DocumentRequestLifecycleAction: React.FC<DocumentRequestLifecycleActionProps> = ({
  request,
  disabled,
  onTransition,
}) => {
  const [targetStatus, setTargetStatus] = useState<DocumentRequestStatus | ''>('');
  const [justification, setJustification] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [localError, setLocalError] = useState('');
  const optionsQuery = useDocumentRequestOptions(
    request.clienteId,
    request.competencia,
    Boolean(targetStatus),
  );

  const close = () => {
    setTargetStatus('');
    setJustification('');
    setDocumentId('');
    setLocalError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetStatus) return;
    setLocalError('');
    try {
      await onTransition({
        id: request.id,
        status: targetStatus,
        justification,
        documentId: documentId || undefined,
      });
      close();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível registrar a transição.');
    }
  };

  return (
    <div className="document-request-lifecycle">
      <div className="document-request-evidence">
        {request.documentoId ? (
          <span><FileCheck2 size={13} /> {request.documentoNome || 'Documento vinculado'}</span>
        ) : (
          <span className="is-missing"><FileWarning size={13} /> Sem arquivo anexado</span>
        )}
        {request.auditoriaPendente && (
          <span className="is-audit-pending"><ShieldAlert size={13} /> Revisão de auditoria pendente</span>
        )}
      </div>
      {request.history.length > 0 && (
        <details className="document-request-history">
          <summary>Histórico auditável ({request.history.length})</summary>
          <ol>
            {request.history.slice().reverse().map((entry) => (
              <li key={entry.id}>
                <strong>{entry.from ? `${entry.from} → ${entry.to}` : entry.to}</strong>
                <span>
                  {entry.actorName || entry.actorUserId || 'Ator indisponível — revisão pendente'}
                  {entry.occurredAt ? ` • ${new Date(entry.occurredAt).toLocaleString('pt-BR')}` : ''}
                </span>
                {entry.justification && <p>{entry.justification}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}

      {!targetStatus ? (
        <div className="document-request-action-list">
          {request.allowedActions.map((status) => (
            <button
              type="button"
              key={status}
              disabled={disabled}
              className={status === 'Cancelado' ? 'is-danger' : ''}
              onClick={() => setTargetStatus(status)}
            >
              <ActionIcon status={status} /> {ACTION_LABELS[status]}
            </button>
          ))}
        </div>
      ) : (
        <form className="document-request-transition-form" onSubmit={submit}>
          <strong>{ACTION_LABELS[targetStatus]}</strong>
          <label>
            Evidência ou justificativa
            <textarea
              required
              minLength={8}
              maxLength={2000}
              rows={2}
              value={justification}
              placeholder="Descreva o que foi conferido ou o motivo da decisão."
              onChange={(event) => setJustification(event.target.value)}
            />
          </label>
          {targetStatus !== 'Pendente' && optionsQuery.data?.documents.length ? (
            <label>
              Documento real (opcional)
              <select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
                <option value="">Sem arquivo — usar justificativa textual</option>
                {optionsQuery.data.documents.map((document) => (
                  <option key={document.id} value={document.id}>{document.nome}</option>
                ))}
              </select>
            </label>
          ) : null}
          {optionsQuery.isFetching && (
            <span className="document-request-transition-status" role="status">
              Consultando arquivos do cliente...
            </span>
          )}
          {optionsQuery.isError && (
            <span className="document-request-transition-error" role="alert">
              Não foi possível consultar os arquivos; você ainda pode registrar a justificativa textual.
            </span>
          )}
          {localError && <span className="document-request-transition-error" role="alert">{localError}</span>}
          <div>
            <button type="button" onClick={close}>Voltar</button>
            <button
              type="submit"
              className="document-request-primary"
              disabled={disabled || optionsQuery.isFetching || justification.trim().length < 8}
            >
              Confirmar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
