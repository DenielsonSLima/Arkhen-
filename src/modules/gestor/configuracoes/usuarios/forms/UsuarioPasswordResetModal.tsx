import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import {
  EMPLOYEE_PASSWORD_MAX_LENGTH,
  EMPLOYEE_PASSWORD_MIN_LENGTH,
  EMPLOYEE_PASSWORD_REQUIREMENTS,
  validateEmployeePassword,
} from '../../../../../lib/employeePasswordPolicy';
import type { Usuario } from '../services/usuariosService';
import './UsuarioForm.css';
import './UsuarioIdentityFields.css';

interface UsuarioPasswordResetModalProps {
  usuario: Usuario;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export const UsuarioPasswordResetModal = ({
  usuario,
  isSaving,
  onCancel,
  onSubmit,
}: UsuarioPasswordResetModalProps) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = validateEmployeePassword(password, usuario.cpf);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmation) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }

    setError(null);
    try {
      await onSubmit(password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível redefinir a senha.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container usuario-modal-container" style={{ maxWidth: 520 }}>
        <div className="usuario-modal-wrapper animate-fade-in">
          <div className="usuario-modal-header">
            <div className="usuario-modal-title-group">
              <span className="usuario-modal-icon"><KeyRound size={20} /></span>
              <div>
                <h3>Redefinir senha</h3>
                <p>{usuario.nome} entrará com o mesmo CPF e a nova senha.</p>
              </div>
            </div>
            <button type="button" className="usuario-modal-close" onClick={onCancel} disabled={isSaving} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="usuario-modal-form">
            <div className="usuario-modal-content-scroll">
              {error && <div className="form-alert-banner error usuario-modal-error" role="alert">{error}</div>}
              <div className="usuario-fields-grid">
                <div className="form-item-group span-2">
                  <label htmlFor="usuario-reset-password">Nova senha</label>
                  <div className="usuario-password-field">
                    <input
                      id="usuario-reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                      maxLength={EMPLOYEE_PASSWORD_MAX_LENGTH}
                      disabled={isSaving}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={isSaving}
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="usuario-field-hint">{EMPLOYEE_PASSWORD_REQUIREMENTS}</span>
                </div>
                <div className="form-item-group span-2">
                  <label htmlFor="usuario-reset-confirmation">Confirmar nova senha</label>
                  <input
                    id="usuario-reset-confirmation"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                    maxLength={EMPLOYEE_PASSWORD_MAX_LENGTH}
                    disabled={isSaving}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="usuario-modal-footer">
              <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>Cancelar</button>
              <button type="submit" className="btn-invite" disabled={isSaving}>
                {isSaving ? 'Redefinindo...' : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
