import React from 'react';
import { Edit2, Trash2, UserPlus, UserX } from 'lucide-react';
import { useUsuarios } from './hooks/useUsuarios';
import { UsuarioForm } from './forms/UsuarioForm';

export const UsuariosConfig: React.FC = () => {
  const {
    usuarios,
    perfis,
    isLoading,
    isSaving,
    showForm,
    selectedUsuario,
    formValue,
    setFormValue,
    successMsg,
    errorMsg,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleInativar,
    handleExcluir,
  } = useUsuarios();

  if (isLoading) {
    return <div className="sub-loading">Carregando usuários reais do Supabase...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Gestão de Usuários</h2>
          <p>Gerencie dados, perfis, status e janelas de acesso por dia e horário.</p>
        </div>
        <button className="btn-add-user" onClick={openCreate}>
          <UserPlus size={16} /> Novo Usuário
        </button>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="form-alert-banner error" style={{ marginBottom: '12px' }}>{errorMsg}</div>}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '760px' }}>
            <h3>{selectedUsuario ? 'Editar Usuário' : 'Cadastrar Usuário'}</h3>
            <p style={{ margin: '4px 0 16px', color: '#64748b', fontSize: '0.86rem' }}>
              {selectedUsuario ? 'Clique em salvar para aplicar os dados e regras de acesso.' : 'O usuário ficará pendente até confirmar o acesso no Supabase Auth.'}
            </p>
            <UsuarioForm
              value={formValue}
              perfis={perfis}
              isSaving={isSaving}
              onChange={setFormValue}
              onSubmit={handleSave}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="config-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Restrição</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((user) => (
              <tr key={user.id} onClick={() => openEdit(user)} style={{ cursor: 'pointer' }}>
                <td><strong>{user.nome}</strong></td>
                <td>{user.email}</td>
                <td>{user.cpf || '-'}</td>
                <td>{user.telefone || '-'}</td>
                <td>{user.perfil}</td>
                <td>
                  <span className={`table-badge ${user.status === 'Ativo' ? 'badge-green' : user.status === 'Pendente' ? 'badge-orange' : 'badge-gray'}`}>
                    {user.status}
                  </span>
                </td>
                <td>{user.accessConfig.enabled ? 'Dias/horários personalizados' : 'Livre'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-action-responsavel"
                      title="Editar"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(user);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {user.status !== 'Inativo' && (
                      <button
                        className="btn-action-responsavel"
                        title="Inativar"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleInativar(user);
                        }}
                      >
                        <UserX size={14} />
                      </button>
                    )}
                    <button
                      className="btn-action-responsavel"
                      title="Excluir se não houver histórico"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleExcluir(user);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>
                  Nenhum usuário cadastrado para esta empresa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
