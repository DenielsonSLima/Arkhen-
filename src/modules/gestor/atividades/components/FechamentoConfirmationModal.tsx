import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SystemErrorToast } from '../../components/SystemErrorToast';

interface Props {
  isOpen: boolean;
  reopening: boolean;
  onClose: () => void;
  onConfirm: (justificativa: string) => Promise<void>;
}

export const FechamentoConfirmationModal = ({ isOpen, reopening, onClose, onConfirm }: Props) => {
  const [justificativa, setJustificativa] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (!isOpen) return null;
  const close = () => { if (!saving) { setJustificativa(''); setError(null); onClose(); } };
  const confirm = async () => {
    if (saving) return;
    if (reopening && justificativa.trim().length < 8) {
      setError(new Error('Informe uma justificativa de pelo menos 8 caracteres para reabrir.'));
      return;
    }
    setSaving(true);
    setError(null);
    try { await onConfirm(justificativa); setJustificativa(''); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error('Não foi possível salvar o fechamento.')); }
    finally { setSaving(false); }
  };
  return createPortal(
    <div className="confirm-modal-backdrop" onClick={close}>
      <SystemErrorToast error={error} />
      <div className="confirm-modal-container" onClick={(event) => event.stopPropagation()}>
        <h3 className="confirm-modal-title">{reopening ? 'Reabrir fechamento' : 'Confirmar auditoria contábil'}</h3>
        <p className="confirm-modal-message">{reopening ? 'Informe o motivo da reabertura. Sua autoria e o horário serão registrados automaticamente.' : 'O sistema verificará as obrigações e registrará sua autoria e o horário da confirmação.'}</p>
        {reopening && <div className="form-item-group"><label htmlFor="fechamento-justificativa">Justificativa</label><textarea id="fechamento-justificativa" value={justificativa} maxLength={4000} onChange={(event) => setJustificativa(event.target.value)} /></div>}
        <div className="confirm-modal-buttons">
          <button className="confirm-btn confirm-btn-no" onClick={close}>Cancelar</button>
          <button className="confirm-btn confirm-btn-yes" onClick={() => { void confirm(); }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
        </div>
      </div>
    </div>, document.body,
  );
};
