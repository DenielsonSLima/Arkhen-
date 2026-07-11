import React, { useState } from 'react';
import { Plus, Search, Check, X, Edit, Trash2 } from 'lucide-react';
import { useCnae } from '../hooks/useCnae';
import { FormCard } from '../../gestao-empresarial/forms/FormCard';
import { AddCnaeForm } from './forms/AddCnaeForm';
import { EditCnaeForm } from './forms/EditCnaeForm';
import type { Cnae } from '../services/parametrizacaoService';

export const CnaePage: React.FC = () => {
  const {
    cnaes,
    isLoading,
    isSaving,
    successMsg,
    searchQuery,
    setSearchQuery,
    editingCnae,
    setEditingCnae,
    showModal,
    setShowModal,
    handleSaveCnae,
    handleDeleteCnae,
  } = useCnae();

  const [cnaeToDelete, setCnaeToDelete] = useState<Cnae | null>(null);

  const openAddModal = () => {
    setEditingCnae(null);
    setShowModal(true);
  };

  const openEditModal = (cnae: Cnae) => {
    setEditingCnae(cnae);
    setShowModal(true);
  };

  return (
    <div className="submodule-content-card animate-fade-in">
      {/* Header */}
      <div className="table-actions-row">
        <div>
          <h2>Atividades Econômicas (CNAE)</h2>
          <p style={{ fontSize: '0.82rem', color: '#666', marginTop: '2px' }}>
            Gerencie as atividades econômicas de seus clientes, com anexos do Simples Nacional e percentuais de presunção contábil.
          </p>
        </div>
        <button className="btn-add-user" onClick={openAddModal}>
          <Plus size={16} /> Adicionar CNAE
        </button>
      </div>

      {successMsg && <div className="success-banner" style={{ marginTop: '12px' }}>{successMsg}</div>}

      {/* Search Filter */}
      <div className="parceiros-controls-bar" style={{ marginTop: '16px', padding: '12px 20px', border: '1px solid #eef1f5' }}>
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="sub-loading">Carregando atividades CNAE...</div>
      ) : cnaes.length === 0 ? (
        <div className="empty-state-card" style={{ marginTop: '20px' }}>
          <p>Nenhuma atividade CNAE encontrada.</p>
          <button className="btn-add-user" onClick={openAddModal} style={{ marginTop: '8px' }}>
            Cadastrar Primeiro CNAE
          </button>
        </div>
      ) : (
        <div className="table-responsive" style={{ marginTop: '20px' }}>
          <table className="config-table">
            <thead>
              <tr>
                <th>Código CNAE</th>
                <th>Descrição da Atividade</th>
                <th style={{ textAlign: 'center' }}>Simples Nacional</th>
                <th>Presunção IRPJ</th>
                <th>Presunção CSLL</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cnaes.map((cnae) => (
                <tr key={cnae.id}>
                  <td>
                    <code className="ip-code">{cnae.codigo}</code>
                  </td>
                  <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                    <strong>{cnae.descricao}</strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {cnae.simplesNacional ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <Check size={16} style={{ color: '#2e7d32' }} />
                        <span className="partner-badge mei" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {cnae.simplesAnexo}
                        </span>
                      </div>
                    ) : (
                      <X size={16} style={{ color: '#c62828' }} />
                    )}
                  </td>
                  <td className="gold-text fw-bold">{cnae.presuncaoIrpj.toFixed(2)}%</td>
                  <td className="gold-text fw-bold">{cnae.presuncaoCsll.toFixed(2)}%</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => openEditModal(cnae)}
                      className="btn-action-responsavel"
                      title="Editar CNAE"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => setCnaeToDelete(cnae)}
                      className="btn-action-responsavel"
                      style={{ color: '#ef4444' }}
                      title="Remover CNAE"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <FormCard
          title={editingCnae ? 'Editar Registro CNAE' : 'Cadastrar Novo CNAE'}
          onClose={() => setShowModal(false)}
        >
          {editingCnae ? (
            <EditCnaeForm
              cnae={editingCnae}
              onSave={handleSaveCnae}
              onCancel={() => setShowModal(false)}
              isSaving={isSaving}
            />
          ) : (
            <AddCnaeForm
              onSave={handleSaveCnae}
              onCancel={() => setShowModal(false)}
              isSaving={isSaving}
            />
          )}
        </FormCard>
      )}

      {/* Delete Confirmation Modal */}
      {cnaeToDelete && (
        <div className="modal-backdrop" onClick={() => setCnaeToDelete(null)}>
          <div className="modal-container confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal-title" style={{ color: '#ef4444' }}>Excluir CNAE</h3>
            <p className="confirm-modal-message">
              Deseja realmente remover o CNAE <strong>{cnaeToDelete.codigo}</strong>? Isso poderá afetar as regras de apuração vinculadas a esta atividade.
            </p>
            <div className="confirm-modal-buttons popup-form-buttons">
              <button className="btn-cancel" onClick={() => setCnaeToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-invite"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: 'none' }}
                onClick={() => {
                  handleDeleteCnae(cnaeToDelete.id);
                  setCnaeToDelete(null);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
