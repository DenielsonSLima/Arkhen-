import { useState } from 'react';
import { Eye, EyeOff, IdCard, Mail } from 'lucide-react';
import { formatCpf } from '../../../../../lib/cpf';
import {
  EMPLOYEE_PASSWORD_MAX_LENGTH,
  EMPLOYEE_PASSWORD_MIN_LENGTH,
  EMPLOYEE_PASSWORD_REQUIREMENTS,
} from '../../../../../lib/employeePasswordPolicy';
import type { PerfilAcesso } from '../../perfis/services/perfisService';
import type { SaveUsuarioInput, UsuarioAuthMethod, UsuarioStatus } from '../services/usuariosService';
import {
  canUseCpfAccess,
  getCpfAccessProfiles,
  getDefaultCpfAccessProfile,
  type UsuarioFormErrors,
} from './usuarioFormModel';
import './UsuarioIdentityFields.css';

interface UsuarioIdentityFieldsProps {
  value: SaveUsuarioInput;
  perfis: PerfilAcesso[];
  isSaving: boolean;
  errors: UsuarioFormErrors;
  onChange: (value: SaveUsuarioInput) => void;
}

const FieldError = ({ id, message }: { id: string; message?: string }) => (
  message ? <span id={id} className="usuario-field-error" role="alert">{message}</span> : null
);

export const UsuarioIdentityFields = ({
  value,
  perfis,
  isSaving,
  errors,
  onChange,
}: UsuarioIdentityFieldsProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = Boolean(value.id);
  const isCpfAccess = value.formaAcesso === 'cpf';
  const allowedProfiles = isCpfAccess ? getCpfAccessProfiles(perfis) : perfis;

  const setField = <K extends keyof SaveUsuarioInput>(field: K, fieldValue: SaveUsuarioInput[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const setAuthMethod = (formaAcesso: UsuarioAuthMethod) => {
    const nextValue: SaveUsuarioInput = {
      ...value,
      formaAcesso,
      status: isEdit ? value.status : formaAcesso === 'cpf' ? 'Ativo' : 'Pendente',
      senha: formaAcesso === 'cpf' ? value.senha || '' : undefined,
      confirmacaoSenha: formaAcesso === 'cpf' ? value.confirmacaoSenha || '' : undefined,
    };

    if (formaAcesso === 'cpf') {
      const currentPerfil = perfis.find((perfil) => perfil.nome === value.perfil);
      const defaultPerfil = getDefaultCpfAccessProfile(perfis);
      if (!canUseCpfAccess(currentPerfil)) {
        nextValue.perfil = defaultPerfil?.nome || '';
        nextValue.perfilId = defaultPerfil?.id;
      }
    }
    onChange(nextValue);
  };

  return (
    <>
      <div className="usuario-section-title-wrapper">
        <span className="usuario-access-eyebrow">Identificação</span>
        <h4>Dados do Usuário</h4>
      </div>

      <fieldset className="usuario-auth-method-fieldset" disabled={isSaving || isEdit}>
        <legend>Forma de acesso</legend>
        <div className="usuario-auth-method-grid">
          <button
            type="button"
            className={`usuario-auth-method-card ${isCpfAccess ? 'active' : ''}`}
            onClick={() => setAuthMethod('cpf')}
            aria-pressed={isCpfAccess}
          >
            <IdCard size={18} />
            <span><strong>CPF + senha</strong><small>Para funcionários sem e-mail próprio</small></span>
          </button>
          <button
            type="button"
            className={`usuario-auth-method-card ${!isCpfAccess ? 'active' : ''}`}
            onClick={() => setAuthMethod('email')}
            aria-pressed={!isCpfAccess}
          >
            <Mail size={18} />
            <span><strong>E-mail</strong><small>Fluxo legado e perfis de gestão</small></span>
          </button>
        </div>
        {isEdit && <p className="usuario-field-hint">A forma de acesso não pode ser trocada durante a edição.</p>}
      </fieldset>

      <div className="usuario-fields-grid">
        <div className="form-item-group span-2">
          <label htmlFor="usuario-nome">Nome Completo</label>
          <input
            id="usuario-nome"
            value={value.nome}
            onChange={(event) => setField('nome', event.target.value)}
            disabled={isSaving}
            required
            maxLength={150}
            aria-invalid={Boolean(errors.nome)}
            aria-describedby={errors.nome ? 'usuario-nome-error' : undefined}
            placeholder="Digite o nome completo"
          />
          <FieldError id="usuario-nome-error" message={errors.nome} />
        </div>

        <div className={isCpfAccess ? 'form-item-group' : 'form-item-group span-2'}>
          <label htmlFor="usuario-email">E-mail{isCpfAccess ? ' (opcional)' : ''}</label>
          <input
            id="usuario-email"
            type="email"
            value={value.email}
            onChange={(event) => setField('email', event.target.value)}
            disabled={isSaving}
            required={!isCpfAccess}
            maxLength={150}
            autoComplete="off"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'usuario-email-error' : undefined}
            placeholder={isCpfAccess ? 'Contato opcional' : 'exemplo@email.com'}
          />
          <FieldError id="usuario-email-error" message={errors.email} />
        </div>

        <div className="form-item-group">
          <label htmlFor="usuario-cpf">CPF</label>
          <input
            id="usuario-cpf"
            value={formatCpf(value.cpf)}
            onChange={(event) => setField('cpf', formatCpf(event.target.value))}
            disabled={isSaving || (isEdit && isCpfAccess)}
            required
            inputMode="numeric"
            autoComplete="username"
            maxLength={14}
            aria-invalid={Boolean(errors.cpf)}
            aria-describedby={errors.cpf ? 'usuario-cpf-error' : undefined}
            placeholder="000.000.000-00"
          />
          <FieldError id="usuario-cpf-error" message={errors.cpf} />
        </div>

        <div className="form-item-group">
          <label htmlFor="usuario-telefone">Telefone{isCpfAccess ? ' (opcional)' : ''}</label>
          <input
            id="usuario-telefone"
            value={value.telefone}
            onChange={(event) => setField('telefone', event.target.value)}
            disabled={isSaving}
            required={!isCpfAccess}
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            aria-invalid={Boolean(errors.telefone)}
            aria-describedby={errors.telefone ? 'usuario-telefone-error' : undefined}
            placeholder="(00) 00000-0000"
          />
          <FieldError id="usuario-telefone-error" message={errors.telefone} />
        </div>

        {isCpfAccess && !isEdit && (
          <>
            <div className="form-item-group">
              <label htmlFor="usuario-senha">Senha inicial</label>
              <div className="usuario-password-field">
                <input
                  id="usuario-senha"
                  type={showPassword ? 'text' : 'password'}
                  value={value.senha || ''}
                  onChange={(event) => setField('senha', event.target.value)}
                  disabled={isSaving}
                  required
                  minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                  maxLength={EMPLOYEE_PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.senha)}
                  aria-describedby={errors.senha ? 'usuario-senha-error' : 'usuario-password-hint'}
                  placeholder="Letras e números"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isSaving}
                  aria-label={showPassword ? 'Ocultar senhas' : 'Exibir senhas'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError id="usuario-senha-error" message={errors.senha} />
            </div>

            <div className="form-item-group">
              <label htmlFor="usuario-confirmacao-senha">Confirmar senha</label>
              <input
                id="usuario-confirmacao-senha"
                type={showPassword ? 'text' : 'password'}
                value={value.confirmacaoSenha || ''}
                onChange={(event) => setField('confirmacaoSenha', event.target.value)}
                disabled={isSaving}
                required
                minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                maxLength={EMPLOYEE_PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmacaoSenha)}
                aria-describedby={errors.confirmacaoSenha ? 'usuario-confirmacao-error' : undefined}
                placeholder="Repita a senha"
              />
              <FieldError id="usuario-confirmacao-error" message={errors.confirmacaoSenha} />
            </div>
            <p id="usuario-password-hint" className="usuario-field-hint span-2">
              {EMPLOYEE_PASSWORD_REQUIREMENTS}
            </p>
          </>
        )}

        <div className="form-item-group">
          <label htmlFor="usuario-perfil">Perfil de Acesso</label>
          <select
            id="usuario-perfil"
            value={value.perfilId || allowedProfiles.find((perfil) => perfil.nome === value.perfil)?.id || ''}
            onChange={(event) => {
              const perfil = allowedProfiles.find((item) => item.id === event.target.value);
              onChange({ ...value, perfil: perfil?.nome || '', perfilId: perfil?.id });
            }}
            disabled={isSaving || allowedProfiles.length === 0}
            required
            aria-invalid={Boolean(errors.perfil)}
            aria-describedby={errors.perfil ? 'usuario-perfil-error' : undefined}
          >
            {allowedProfiles.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>
            ))}
            {allowedProfiles.length === 0 && <option value="">Nenhum perfil disponível</option>}
          </select>
          {isCpfAccess && (
            <span className="usuario-field-hint">Perfis com gestão de usuários, perfis ou configurações usam e-mail.</span>
          )}
          <FieldError id="usuario-perfil-error" message={errors.perfil} />
        </div>

        <div className="form-item-group">
          <label htmlFor="usuario-status">Status</label>
          <select
            id="usuario-status"
            value={value.status}
            onChange={(event) => setField('status', event.target.value as UsuarioStatus)}
            disabled={isSaving}
          >
            <option value="Ativo">Ativo</option>
            <option value="Pendente">Pendente</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
      </div>
    </>
  );
};
