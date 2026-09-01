import { useState, type CSSProperties, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import {
  EMPLOYEE_PASSWORD_MAX_LENGTH,
  EMPLOYEE_PASSWORD_MIN_LENGTH,
  EMPLOYEE_PASSWORD_REQUIREMENTS,
  validateEmployeePassword,
} from '../../../../../lib/employeePasswordPolicy';

type ProfileAuthMethod = 'email' | 'cpf';

interface ProfileSecurityCardsProps {
  authMethod: ProfileAuthMethod;
  cpf: string;
  email: string;
  isChangingPassword: boolean;
  isSendingResetEmail: boolean;
  onChangePassword: (password: string) => Promise<boolean>;
  onSendResetEmail: () => void;
  onError: (message: string) => void;
}

const inputStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  boxSizing: 'border-box',
  color: '#111827',
  fontSize: '0.85rem',
  padding: '10px 38px 10px 36px',
  width: '100%',
};

export const ProfileSecurityCards = ({
  authMethod,
  cpf,
  email,
  isChangingPassword,
  isSendingResetEmail,
  onChangePassword,
  onSendResetEmail,
  onError,
}: ProfileSecurityCardsProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = authMethod === 'cpf'
      ? validateEmployeePassword(newPassword, cpf)
      : newPassword.length < 6
        ? 'A nova senha deve possuir no mínimo 6 caracteres.'
        : null;
    if (passwordError) {
      onError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      onError('A confirmação não bate com a nova senha.');
      return;
    }

    const changed = await onChangePassword(newPassword);
    if (changed) {
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const passwordFields = [
    {
      id: 'profile-new-password',
      label: 'Nova Senha',
      value: newPassword,
      setter: setNewPassword,
      show: showNew,
      setShow: setShowNew,
      placeholder: authMethod === 'cpf'
        ? `${EMPLOYEE_PASSWORD_MIN_LENGTH} a ${EMPLOYEE_PASSWORD_MAX_LENGTH} caracteres`
        : 'Min. 6 caracteres',
    },
    {
      id: 'profile-confirm-password',
      label: 'Confirmar Nova Senha',
      value: confirmPassword,
      setter: setConfirmPassword,
      show: showConfirm,
      setShow: setShowConfirm,
      placeholder: 'Repita a nova senha',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <form
        onSubmit={handleSubmit}
        style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
          Alterar Senha de Acesso
        </h4>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45 }}>
          {authMethod === 'cpf'
            ? EMPLOYEE_PASSWORD_REQUIREMENTS
            : 'Altera a senha da sessão autenticada atual. Para receber um link por e-mail, use a opção de redefinição abaixo.'}
        </p>

        {passwordFields.map((field) => (
          <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor={field.id} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{field.label}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                id={field.id}
                type={field.show ? 'text' : 'password'}
                value={field.value}
                onChange={(event) => field.setter(event.target.value)}
                placeholder={field.placeholder}
                style={inputStyle}
                minLength={authMethod === 'cpf' ? EMPLOYEE_PASSWORD_MIN_LENGTH : 6}
                maxLength={authMethod === 'cpf' ? EMPLOYEE_PASSWORD_MAX_LENGTH : undefined}
                autoComplete="new-password"
                disabled={isChangingPassword}
                required
              />
              <button
                type="button"
                onClick={() => field.setShow(!field.show)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                disabled={isChangingPassword}
                aria-label={field.show ? `Ocultar ${field.label.toLowerCase()}` : `Exibir ${field.label.toLowerCase()}`}
              >
                {field.show ? <EyeOff size={15} style={{ color: '#64748b' }} /> : <Eye size={15} style={{ color: '#64748b' }} />}
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-save-settings" disabled={isChangingPassword}>
            {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </form>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
          Redefinição por E-mail
        </h4>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45 }}>
          {authMethod === 'cpf'
            ? 'Contas com CPF não recebem e-mail. Se esquecer a senha, solicite uma nova senha ao gestor.'
            : 'Envia um link seguro para o e-mail cadastrado. Esse é o caminho recomendado quando quiser confirmar a troca fora da sessão atual.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <span style={{ color: '#1e293b', fontSize: '0.82rem', fontWeight: 700 }}>
            {authMethod === 'cpf' ? 'Recuperação assistida pelo gestor' : email}
          </span>
          {authMethod === 'email' && (
            <button type="button" className="btn-save-settings" onClick={onSendResetEmail} disabled={isSendingResetEmail}>
              <Mail size={14} /> {isSendingResetEmail ? 'Enviando...' : 'Enviar e-mail'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
