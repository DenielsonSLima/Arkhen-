import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Search, Edit3, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  categoriaFinanceiraKeys,
  categoriaFinanceiraService,
  type CategoriaFinanceira,
} from '../services/categoriaFinanceiraService';
import './ParametrizacaoPlaceholder.css';

export const CategoriaFinanceiraPage: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Queries
  const query = useQuery({
    queryKey: categoriaFinanceiraKeys.all,
    queryFn: categoriaFinanceiraService.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const categories = query.data || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoriaFinanceira | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [tipoDespesa, setTipoDespesa] = useState<'fixa' | 'variavel'>('fixa');
  const [error, setError] = useState('');

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
    try {
      await toggleMutation.mutateAsync({ id: item.id, ativa: item.status !== 'Ativa' });
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status.');
    }
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
          <button className="btn-parametrizacao-add" onClick={() => handleOpenAdd('fixa')}>
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

        {/* Two Columns Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
          
          {/* Column 1: Fixed */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas Fixas</h3>
              <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px', fontWeight: 700, color: '#475569' }}>
                {fixedCategories.length} {fixedCategories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {fixedCategories.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma categoria fixa cadastrada.</div>
              )}
              {fixedCategories.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{c.nome}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: c.status === 'Ativa' ? '#dcfce7' : '#f1f5f9', color: c.status === 'Ativa' ? '#15803d' : '#475569' }}>
                        {c.status}
                      </span>
                      {c.sistema && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                          Padrão
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-action-btn" onClick={() => handleOpenEdit(c)} title="Editar">
                      <Edit3 size={15} />
                    </button>
                    {!c.sistema && (
                      <button className="icon-action-btn" onClick={() => handleToggleStatus(c)} title={c.status === 'Ativa' ? 'Inativar' : 'Ativar'}>
                        {c.status === 'Ativa' ? <ToggleRight size={20} color="#10b981" /> : <ToggleLeft size={20} color="#94a3b8" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Variable */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas Variáveis</h3>
              <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px', fontWeight: 700, color: '#475569' }}>
                {variableCategories.length} {variableCategories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {variableCategories.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma categoria variável cadastrada.</div>
              )}
              {variableCategories.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{c.nome}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: c.status === 'Ativa' ? '#dcfce7' : '#f1f5f9', color: c.status === 'Ativa' ? '#15803d' : '#475569' }}>
                        {c.status}
                      </span>
                      {c.sistema && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                          Padrão
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-action-btn" onClick={() => handleOpenEdit(c)} title="Editar">
                      <Edit3 size={15} />
                    </button>
                    {!c.sistema && (
                      <button className="icon-action-btn" onClick={() => handleToggleStatus(c)} title={c.status === 'Ativa' ? 'Inativar' : 'Ativar'}>
                        {c.status === 'Ativa' ? <ToggleRight size={20} color="#10b981" /> : <ToggleLeft size={20} color="#94a3b8" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="parametrizacao-modal-backdrop">
          <div className="parametrizacao-modal-container" style={{ maxWidth: '480px' }}>
            <div className="parametrizacao-modal-header">
              <Database size={20} style={{ color: 'var(--color-gold-primary)' }} />
              <h3>{editingCategory ? 'Editar Categoria' : 'Nova Categoria Financeira'}</h3>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="form-field">
                <label>Nome da Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel de Equipamentos"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Tipo de Despesa</label>
                <select 
                  value={tipoDespesa} 
                  onChange={(e) => setTipoDespesa(e.target.value as 'fixa' | 'variavel')}
                >
                  <option value="fixa">Despesa Fixa</option>
                  <option value="variavel">Despesa Variável</option>
                </select>
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-modal secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
