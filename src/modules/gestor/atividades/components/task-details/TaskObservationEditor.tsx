import React from 'react';
import type { StatusAtividadeGestor } from '../../services/rotinasAtividadesService';

interface TaskObservationEditorProps {
  status: StatusAtividadeGestor;
  isReadOnly: boolean;
  actionError: string;
  observationDraft: string;
  observationDirty: boolean;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
}

export const TaskObservationEditor: React.FC<TaskObservationEditorProps> = ({
  status,
  isReadOnly,
  actionError,
  observationDraft,
  observationDirty,
  isSaving,
  onChange,
  onSave,
}) => (
  <>
    {isReadOnly && (
      <div
        id="task-read-only-message"
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          color: '#475569',
          fontSize: '0.78rem',
          fontWeight: 700,
          padding: '9px 11px',
        }}
      >
        Esta tarefa está {status.toLowerCase()} e não aceita alterações.
      </div>
    )}

    {actionError && (
      <div
        role="alert"
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#b91c1c',
          fontSize: '0.78rem',
          fontWeight: 700,
          padding: '9px 11px',
        }}
      >
        {actionError}
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label
        htmlFor="task-observation"
        style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}
      >
        Observações / bloqueio
      </label>
      <textarea
        id="task-observation"
        value={observationDraft}
        onChange={(event) => onChange(event.target.value)}
        disabled={isReadOnly || isSaving}
        aria-describedby={isReadOnly ? 'task-read-only-message' : undefined}
        rows={4}
        maxLength={2000}
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
          opacity: isReadOnly ? 0.7 : 1,
        }}
        onFocus={(event) => { event.target.style.borderColor = '#c59235'; }}
        onBlur={(event) => { event.target.style.borderColor = '#cbd5e1'; }}
      />
      <button
        type="button"
        onClick={() => { void onSave(); }}
        disabled={isReadOnly || isSaving || !observationDirty}
        style={{
          alignSelf: 'flex-end',
          background: '#ffffff',
          border: '1px solid rgba(197, 146, 53, 0.65)',
          borderRadius: '8px',
          color: '#9a6e20',
          cursor: isReadOnly || isSaving || !observationDirty ? 'not-allowed' : 'pointer',
          font: 'inherit',
          fontSize: '0.76rem',
          fontWeight: 800,
          opacity: isReadOnly || !observationDirty ? 0.6 : 1,
          padding: '8px 12px',
        }}
      >
        {isSaving ? 'Salvando...' : 'Salvar observação'}
      </button>
    </div>
  </>
);
