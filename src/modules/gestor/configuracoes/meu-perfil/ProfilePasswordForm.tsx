import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface ProfilePasswordFormProps {
  newPassword: string;
  confirmPassword: string;
  isChanging: boolean;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

const inputStyle: React.CSSProperties = {
  padding: '10px 38px 10px 36px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.85rem',
  backgroundColor: '#ffffff',
  color: '#111827',
  width: '100%',
  boxSizing: 'border-box',
};

export const ProfilePasswordForm: React.FC<ProfilePasswordFormProps> = ({
  newPassword,
  confirmPassword,
  isChanging,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}) => {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fields = [
    {
      label: 'Nova Senha',
      value: newPassword,
      setter: onNewPasswordChange,
      show: showNew,
      toggle: () => setShowNew((current) => !current),
      placeholder: 'Mín. 8 caracteres, com letra e número',
    },
    {
      label: 'Confirmar Nova Senha',
      value: confirmPassword,
      setter: onConfirmPasswordChange,
      show: showConfirm,
      toggle: () => setShowConfirm((current) => !current),
      placeholder: 'Repita a nova senha',
    },
  ];

  return (
    <form onSubmit={onSubmit} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
        Alterar Senha de Acesso
      </h4>
      <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45 }}>
        Use pelo menos 8 caracteres, incluindo uma letra e um número. Para receber um link por e-mail, use a opção de redefinição abaixo.
      </p>

      {fields.map((field) => (
        <div key={field.label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{field.label}</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type={field.show ? 'text' : 'password'}
              value={field.value}
              onChange={(event) => field.setter(event.target.value)}
              placeholder={field.placeholder}
              style={inputStyle}
              disabled={isChanging}
            />
            <button type="button" onClick={field.toggle} aria-label={field.show ? `Ocultar ${field.label}` : `Exibir ${field.label}`} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
              {field.show ? <EyeOff size={15} style={{ color: '#64748b' }} /> : <Eye size={15} style={{ color: '#64748b' }} />}
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn-save-settings" disabled={isChanging}>
          {isChanging ? 'Alterando...' : 'Alterar Senha'}
        </button>
      </div>
    </form>
  );
};
