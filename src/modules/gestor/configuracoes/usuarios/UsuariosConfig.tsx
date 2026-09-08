import React from 'react';
import { UserPlus } from 'lucide-react';
import { useUsuarios } from './hooks/useUsuarios';
import { UsuarioForm } from './forms/UsuarioForm';
import { UsuarioPasswordResetModal } from './forms/UsuarioPasswordResetModal';
import { UsuarioTemporaryPasswordModal } from './forms/UsuarioTemporaryPasswordModal';
import { UsuarioCard } from './components/UsuarioCard';
import { useUsuarioInvitationsQuery } from './queries/useUsuarioInvitationsQueries';

export const UsuariosConfig: React.FC = () => {
  const {
    usuarios,
    perfis,
    isLoading,
    isSaving,
    showForm,
    temporaryAccessResult,
    passwordResetUsuario,
    isResettingPassword,
    formValue,
    setFormValue,
    formErrors,
    successMsg,
    errorMsg,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleInativar,
    handleExcluir,
    openPasswordReset,
    closePasswordReset,
    handlePasswordReset,
    closeTemporaryAccessResult,
  } = useUsuarios();
  const invitations = useUsuarioInvitationsQuery(usuarios);

  if (isLoading) {
    return <div className="sub-loading">Carregando usuários...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Gestão de Usuários</h2>
          <p>Acompanhe acessos, convites e permissões da sua equipe.</p>
        </div>
        <button className="btn-add-user" onClick={openCreate}>
          <UserPlus size={16} /> Novo Usuário
        </button>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="form-alert-banner error" style={{ marginBottom: '12px' }}>{errorMsg}</div>}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-container usuario-modal-container">
            <UsuarioForm
              value={formValue}
              perfis={perfis}
              isSaving={isSaving}
              errors={formErrors}
              errorMessage={errorMsg}
              onChange={setFormValue}
              onSubmit={handleSave}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      {passwordResetUsuario && (
        <UsuarioPasswordResetModal
          usuario={passwordResetUsuario}
          isSaving={isResettingPassword}
          onCancel={closePasswordReset}
          onSubmit={handlePasswordReset}
        />
      )}

      {temporaryAccessResult && (
        <UsuarioTemporaryPasswordModal
          usuarioNome={temporaryAccessResult.usuarioNome}
          cpf={temporaryAccessResult.cpf}
          temporaryPassword={temporaryAccessResult.temporaryPassword}
          onClose={closeTemporaryAccessResult}
        />
      )}

      <div className="usuario-cards-region">
        {usuarios.length > 0 ? (
          <div className="usuario-cards-grid">
            {usuarios.map((usuario) => (
              <UsuarioCard
                key={usuario.id}
                usuario={usuario}
                invitation={invitations.data?.find((invitation) => invitation.usuario_id === usuario.id)}
                invitationLoading={invitations.isPending}
                invitationError={invitations.isError}
                onEdit={openEdit}
                onInativar={handleInativar}
                onResetPassword={openPasswordReset}
                onExcluir={handleExcluir}
              />
            ))}
          </div>
        ) : (
          <div className="usuario-cards-empty">Nenhum usuário cadastrado para esta empresa.</div>
        )}
      </div>
    </div>
  );
};
