import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Database, Plus, Search, Edit3, ToggleLeft, ToggleRight, X } from 'lucide-react';
import {
  categoriaFinanceiraKeys,
  categoriaFinanceiraService,
  type CategoriaFinanceira,
} from '../services/categoriaFinanceiraService';
import './ParametrizacaoPlaceholder.css';
import './CategoriaFinanceiraPage.css';

export const CategoriaFinanceiraPage: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Queries
  const query = useQuery({
    queryKey: categoriaFinanceiraKeys.all,
    queryFn: categoriaFinanceiraService.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const categories = useMemo(() => query.data ?? [], [query.data]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoriaFinanceira | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [tipoDespesa, setTipoDespesa] = useState<'fixa' | 'variavel'>('fixa');
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        await categoriaFinanceiraService.update(editingCategory.id, nome, tipoDespesa, editingCategory.status === 'Ativa');
        return;
      }
      await categoriaFinanceiraService.save(nome, tipoDespesa);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriaFinanceiraKeys.all }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      categoriaFinanceiraService.setStatus(id, ativa),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriaFinanceiraKeys.all }),
  });

  useEffect(() => {
    if (!showModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saveMutation.isPending) {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, saveMutation.isPending]);

  // Filters
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return categories.filter((c) => c.nome.toLowerCase().includes(term));
  }, [categories, searchTerm]);

  // Split into columns
  const fixedCategories = useMemo(() => {
    return filtered.filter((c) => c.tipoDespesa === 'fixa');
  }, [filtered]);

  const variableCategories = useMemo(() => {
    return filtered.filter((c) => c.tipoDespesa === 'variavel');
  }, [filtered]);

  const handleOpenAdd = (defaultType: 'fixa' | 'variavel' = 'fixa') => {
    setEditingCategory(null);
    setNome('');
    setTipoDespesa(defaultType);
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (category: CategoriaFinanceira) => {
    setEditingCategory(category);
    setNome(category.nome);
    setTipoDespesa(category.tipoDespesa);
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
      setError(err.message || 'Erro ao salvar categoria.');
    }
  };

  const handleToggleStatus = async (item: CategoriaFinanceira) => {
    setPageError('');
    try {
      await toggleMutation.mutateAsync({ id: item.id, ativa: item.status !== 'Ativa' });
    } catch (err: any) {
      setPageError(err.message || 'Erro ao atualizar status.');
    }
  };

  const handleCloseModal = () => {
    if (!saveMutation.isPending) setShowModal(false);
  };

  return (
    <div className="parametrizacao-page animate-fade-in">
      <div className="submodule-content-card">
        {/* Header */}
        <div className="submodule-card-header flex-header">
          <div className="parametrizacao-title">
            <span className="parametrizacao-title-icon">
              <Database size={22} style={{ color: 'var(--color-gold-primary)' }} />
            </span>
            <div>
              <h2>Categorias Financeiras</h2>
              <p>Gerencie as classificações de despesas fixas e variáveis para controle e lançamento do Contas a Pagar.</p>
            </div>
          </div>
          <button type="button" className="categoria-financeira-primary-button" onClick={() => handleOpenAdd('fixa')}>
            <Plus size={16} />
            Nova Categoria
          </button>
        </div>

        {/* Search */}
        <div className="submodule-filter-bar">
          <div className="search-input-wrapper">
            <Search size={16} className="search-input-icon" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {(query.isError || pageError) && (
          <div className="categoria-financeira-page-error" role="alert">
            <AlertCircle size={18} />
            <span>{pageError || (query.error instanceof Error ? query.error.message : 'Não foi possível carregar as categorias financeiras.')}</span>
            {pageError && <button type="button" onClick={() => setPageError('')} aria-label="Fechar aviso"><X size={16} /></button>}
          </div>
        )}

        {/* Two Columns Grid */}
        <div className="categoria-financeira-grid">
          
          {/* Column 1: Fixed */}
          <section className="categoria-financeira-column" aria-labelledby="categorias-fixas-title">
            <div className="categoria-financeira-column-header">
              <h3 id="categorias-fixas-title">Despesas Fixas</h3>
              <span className="categoria-financeira-count">
                {fixedCategories.length} {fixedCategories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>
            
            <div className="categoria-financeira-list">
              {fixedCategories.length === 0 && (
                <div className="categoria-financeira-empty">Nenhuma categoria fixa cadastrada.</div>
              )}
              {fixedCategories.map((c) => (
                <article key={c.id} className="categoria-financeira-item">
                  <div className="categoria-financeira-item-content">
                    <strong>{c.nome}</strong>
                    <div className="categoria-financeira-badges">
                      <span className={`categoria-financeira-status ${c.status === 'Ativa' ? 'is-active' : 'is-inactive'}`}>
                        {c.status}
                      </span>
                      {c.sistema && (
                        <span className="categoria-financeira-system-badge">
                          Padrão
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="categoria-financeira-actions">
                    <button type="button" className="categoria-financeira-icon-button" onClick={() => handleOpenEdit(c)} title={`Editar ${c.nome}`} aria-label={`Editar ${c.nome}`}>
                      <Edit3 size={15} />
                    </button>
                    {!c.sistema && (
                      <button type="button" className="categoria-financeira-icon-button" onClick={() => handleToggleStatus(c)} title={c.status === 'Ativa' ? `Inativar ${c.nome}` : `Ativar ${c.nome}`} aria-label={c.status === 'Ativa' ? `Inativar ${c.nome}` : `Ativar ${c.nome}`} disabled={toggleMutation.isPending}>
                        {c.status === 'Ativa' ? <ToggleRight size={20} className="is-active" /> : <ToggleLeft size={20} />}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Column 2: Variable */}
          <section className="categoria-financeira-column" aria-labelledby="categorias-variaveis-title">
            <div className="categoria-financeira-column-header">
              <h3 id="categorias-variaveis-title">Despesas Variáveis</h3>
              <span className="categoria-financeira-count">
                {variableCategories.length} {variableCategories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>
            
            <div className="categoria-financeira-list">
              {variableCategories.length === 0 && (
                <div className="categoria-financeira-empty">Nenhuma categoria variável cadastrada.</div>
              )}
              {variableCategories.map((c) => (
                <article key={c.id} className="categoria-financeira-item">
                  <div className="categoria-financeira-item-content">
                    <strong>{c.nome}</strong>
                    <div className="categoria-financeira-badges">
                      <span className={`categoria-financeira-status ${c.status === 'Ativa' ? 'is-active' : 'is-inactive'}`}>
                        {c.status}
                      </span>
                      {c.sistema && (
                        <span className="categoria-financeira-system-badge">
                          Padrão
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="categoria-financeira-actions">
                    <button type="button" className="categoria-financeira-icon-button" onClick={() => handleOpenEdit(c)} title={`Editar ${c.nome}`} aria-label={`Editar ${c.nome}`}>
                      <Edit3 size={15} />
                    </button>
                    {!c.sistema && (
                      <button type="button" className="categoria-financeira-icon-button" onClick={() => handleToggleStatus(c)} title={c.status === 'Ativa' ? `Inativar ${c.nome}` : `Ativar ${c.nome}`} aria-label={c.status === 'Ativa' ? `Inativar ${c.nome}` : `Ativar ${c.nome}`} disabled={toggleMutation.isPending}>
                        {c.status === 'Ativa' ? <ToggleRight size={20} className="is-active" /> : <ToggleLeft size={20} />}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Modal Add/Edit */}
      {showModal && createPortal(
        <div className="categoria-financeira-modal-backdrop" onMouseDown={handleCloseModal}>
          <section className="categoria-financeira-modal" role="dialog" aria-modal="true" aria-labelledby="categoria-financeira-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="categoria-financeira-modal-header">
              <div className="categoria-financeira-modal-heading">
                <span className="categoria-financeira-modal-icon"><Database size={21} /></span>
                <div>
                  <h3 id="categoria-financeira-modal-title">{editingCategory ? 'Editar categoria' : 'Nova categoria financeira'}</h3>
                  <p>{editingCategory ? 'Atualize a identificação e o tipo da categoria.' : 'Cadastre uma classificação para organizar o Contas a Pagar.'}</p>
                </div>
              </div>
              <button type="button" className="categoria-financeira-modal-close" onClick={handleCloseModal} aria-label="Fechar formulário" disabled={saveMutation.isPending}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSave} className="categoria-financeira-form">
              <div className="categoria-financeira-form-field">
                <label htmlFor="categoria-financeira-nome">Nome da categoria</label>
                <input
                  id="categoria-financeira-nome"
                  type="text"
                  required
                  placeholder="Ex: Aluguel de Equipamentos"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="categoria-financeira-form-field">
                <label htmlFor="categoria-financeira-tipo">Tipo de despesa</label>
                <select
                  id="categoria-financeira-tipo"
                  value={tipoDespesa} 
                  onChange={(e) => setTipoDespesa(e.target.value as 'fixa' | 'variavel')}
                >
                  <option value="fixa">Despesa Fixa</option>
                  <option value="variavel">Despesa Variável</option>
                </select>
              </div>

              {error && (
                <div className="categoria-financeira-form-error" role="alert">
                  <AlertCircle size={17} /> <span>{error}</span>
                </div>
              )}

              <div className="categoria-financeira-modal-actions">
                <button type="button" className="categoria-financeira-secondary-button" onClick={handleCloseModal} disabled={saveMutation.isPending}>
                  Cancelar
                </button>
                <button type="submit" className="categoria-financeira-primary-button" disabled={saveMutation.isPending}>
                  {!saveMutation.isPending && <Plus size={17} />}
                  {saveMutation.isPending ? 'Salvando...' : editingCategory ? 'Salvar alterações' : 'Criar categoria'}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
};
