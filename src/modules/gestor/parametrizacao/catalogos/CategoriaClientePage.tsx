import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Search, Edit3, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  categoriaClienteKeys,
  categoriaClienteService,
  type CategoriaCliente,
} from '../services/categoriaClienteService';
import './ParametrizacaoPlaceholder.css'; // Usando os mesmos estilos comuns de parametrização

export const CategoriaClientePage: React.FC = () => {
  const queryClient = useQueryClient();
  const categoriasQuery = useQuery({
    queryKey: categoriaClienteKeys.all,
    queryFn: categoriaClienteService.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoriasQuery.data || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoriaCliente | null>(null);
  
  // Form State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState('');
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        await categoriaClienteService.update(editingCategory.id, nome, descricao);
        return;
      }
      await categoriaClienteService.save(nome, descricao);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriaClienteKeys.all }),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) => categoriaClienteService.setStatus(id, ativa),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriaClienteKeys.all }),
  });

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return categories.filter((c) =>
      c.nome.toLowerCase().includes(term) ||
      c.descricao.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setNome('');
    setDescricao('');
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (category: CategoriaCliente) => {
    setEditingCategory(category);
    setNome(category.nome);
    setDescricao(category.descricao);
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome da categoria é obrigatório.');
      return;
    }

    try {
      await saveMutation.mutateAsync();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar categoria no Supabase.');
    }
  };

  const handleToggleStatus = async (item: CategoriaCliente) => {
    try {
      await toggleMutation.mutateAsync({ id: item.id, ativa: item.status !== 'Ativa' });
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status no Supabase.');
    }
  };

  return (
    <div className="parametrizacao-page animate-fade-in">
      <div className="submodule-content-card">
        <div className="submodule-card-header flex-header">
          <div className="parametrizacao-title">
            <span className="parametrizacao-title-icon">
              <Database size={22} style={{ color: 'var(--color-gold-primary)' }} />
            </span>
            <div>
              <h2>Categorias de Clientes</h2>
              <p>Gerencie as categorias de clientes usadas para classificar e organizar o atendimento no escritório.</p>
            </div>
          </div>
          <button type="button" className="btn-add-user" onClick={handleOpenAdd}>
            <Plus size={16} /> Nova Categoria
          </button>
        </div>

        <div className="parametrizacao-toolbar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Nome</th>
                <th>Descrição</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '150px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {categoriasQuery.isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    Carregando categorias no Supabase...
                  </td>
                </tr>
              ) : categoriasQuery.error ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#b91c1c', padding: '32px' }}>
                    Erro ao carregar categorias de clientes.
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    Nenhuma categoria de cliente encontrada.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((item) => {
                  const isAtiva = item.status === 'Ativa';
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.nome}</strong></td>
                      <td style={{ color: '#475569' }}>{item.descricao || '-'}</td>
                      <td>
                        <span className={`status-badge-clear ${isAtiva ? 'active' : 'inactive'}`}>
                          <span className="status-dot"></span>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-action-small"
                            onClick={() => handleToggleStatus(item)}
                            title={isAtiva ? 'Inativar Categoria' : 'Ativar Categoria'}
                          >
                            {isAtiva ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                          </button>
                          <button
                            type="button"
                            className="btn-action-small"
                            onClick={() => handleOpenEdit(item)}
                            title="Editar Categoria"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay para Adicionar/Editar Categoria */}
      {showModal && (
        <div className="modal-overlay-custom" style={{ display: 'flex', alignItems: 'center', padding: '20px' }}>
          <form className="cliente-form-container" onSubmit={handleSave} style={{ maxWidth: '480px' }}>
            <div className="cliente-form-header">
              <h2>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <p>Preencha os dados da categoria de cliente.</p>
            </div>

            {error && (
              <div className="form-alert-banner error">
                <span>{error}</span>
              </div>
            )}

            <div className="cliente-form-main-fields" style={{ gap: '12px' }}>
              <div className="input-container">
                <label>Nome *</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Ex: Holding Familiar"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="input-container">
                <label>Descrição</label>
                <textarea
                  className="input-style"
                  placeholder="Descreva a finalidade desta categoria..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
            </div>

            <div className="form-footer-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-submit">
                Salvar Categoria
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
