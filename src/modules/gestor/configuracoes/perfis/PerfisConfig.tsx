import React from 'react';
import { Edit2, Plus, Power, Shield, Users } from 'lucide-react';
import { usePerfisAcesso } from './hooks/usePerfisAcesso';
import type { PerfilAcesso } from './services/perfisService';
import { getPermissaoLabel } from './services/permissoesCatalog';
import { PerfilFormModal } from './forms/PerfilFormModal';
import { DeletePerfilModal } from './forms/DeletePerfilModal';
import './PerfisConfig.css';

const PerfilCard: React.FC<{
  perfil: PerfilAcesso;
  onEdit: (perfil: PerfilAcesso) => void;
  onDelete: (perfil: PerfilAcesso) => void;
}> = ({ perfil, onEdit, onDelete }) => {
  const visiblePermissoes = perfil.permissoes.slice(0, 5);

  return (
    <div className="perfil-card perfil-access-card" style={{
      backgroundColor: '#ffffff',
      border: '1px solid #eef1f5',
      borderRadius: '10px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px',
    }}>
      <div>
        <div className="perfil-card-meta-row" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span className={`table-badge ${perfil.sistema ? 'badge-blue' : 'badge-gray'}`}>{perfil.tipo}</span>
          <span style={{ alignItems: 'center', color: '#64748b', display: 'flex', fontSize: '0.75rem', gap: '4px' }}>
            <Users size={14} /> {perfil.usuariosCount} {perfil.usuariosCount === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>

        <h3 className="perfil-card-title" style={{ alignItems: 'center', color: '#1e293b', display: 'flex', fontSize: '1rem', gap: '6px', margin: '0 0 8px' }}>
          <Shield size={18} style={{ color: 'var(--color-gold-primary)' }} />
          {perfil.nome}
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45, minHeight: '58px' }}>{perfil.descricao}</p>

        <div className="perfil-card-permissions" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {visiblePermissoes.map((permissao) => (
            <span key={permissao} className="table-badge badge-gray">{getPermissaoLabel(permissao)}</span>
          ))}
          {perfil.permissoes.length > visiblePermissoes.length && (
            <span className="table-badge badge-orange">+{perfil.permissoes.length - visiblePermissoes.length}</span>
          )}
        </div>
      </div>

      <div className="perfil-card-footer" style={{ alignItems: 'center', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Criado em: {perfil.dataCriacao}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="perfil-action-button" onClick={() => onEdit(perfil)} title="Editar perfil" aria-label={`Editar ${perfil.nome}`}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="perfil-action-button danger" onClick={() => onDelete(perfil)} title="Inativar perfil" aria-label={`Inativar ${perfil.nome}`}>
            <Power size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const PerfisConfig: React.FC = () => {
  const {
    perfis,
    isLoading,
    isSaving,
    isDeleting,
    editingPerfil,
    setEditingPerfil,
    deleteTarget,
    setDeleteTarget,
    successMsg,
    errorMsg,
    setErrorMsg,
    handleSave,
    handleDelete,
  } = usePerfisAcesso();

  if (isLoading) {
    return <div className="sub-loading">Carregando perfis de acesso no Supabase...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Perfis de Acesso</h2>
          <p>Defina grupos de usuários e padronize permissões administrativas, financeiras e operacionais.</p>
        </div>
        <button className="btn-add-user" onClick={() => setEditingPerfil({
          id: '',
          codigo: null,
          nome: '',
          descricao: '',
          tipo: 'Personalizado',
          sistema: false,
          permissoes: [],
          usuariosCount: 0,
          dataCriacao: '',
          ordem: 100,
        })}>
          <Plus size={16} /> Novo Perfil
        </button>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div className="perfis-grid" style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', marginTop: '20px' }}>
        {perfis.map((perfil) => (
          <PerfilCard
            key={perfil.id}
            perfil={perfil}
            onEdit={(item) => {
              setErrorMsg(null);
              setEditingPerfil(item);
            }}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      {editingPerfil && (
        <PerfilFormModal
          perfil={editingPerfil.id ? editingPerfil : null}
          isSaving={isSaving}
          onCancel={() => setEditingPerfil(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <DeletePerfilModal
          perfil={deleteTarget}
          isDeleting={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
