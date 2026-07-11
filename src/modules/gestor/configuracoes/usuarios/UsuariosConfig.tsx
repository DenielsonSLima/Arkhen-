import React from 'react';
import { Edit2, Trash2, UserPlus, UserX } from 'lucide-react';
import { useUsuarios } from './hooks/useUsuarios';
import { UsuarioForm } from './forms/UsuarioForm';
import type { Usuario } from './services/usuariosService';

const weekdays = [1, 2, 3, 4, 5];

const getAccessSummary = (user: Usuario) => {
  if (!user.accessConfig.enabled) return 'Livre';
  const isWeekdays = user.accessConfig.days.length === weekdays.length
    && weekdays.every((day) => user.accessConfig.days.includes(day));
  const isCommercialHours = user.accessConfig.intervals.length === 1
    && user.accessConfig.intervals[0]?.start === '08:00'
    && user.accessConfig.intervals[0]?.end === '18:00';
  if (isWeekdays && isCommercialHours) return 'Horário comercial';
  const days = user.accessConfig.days.length === 7 ? 'Todos os dias' : `${user.accessConfig.days.length} dia(s)`;
  const intervals = `${user.accessConfig.intervals.length} intervalo(s)`;
  return `${days} / ${intervals}`;
};

export const UsuariosConfig: React.FC = () => {
  const {
    usuarios,
    perfis,
    isLoading,
    isSaving,
    showForm,
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
          <div className="modal-container usuario-modal-container">
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
                <td>{getAccessSummary(user)}</td>
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
