import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContasBancariasQuery } from '../../configuracoes/contas-bancarias/queries/useContasBancariasQueries';
import { categoriaFinanceiraService } from '../../parametrizacao/services/categoriaFinanceiraService';
import type { ContasPagarParceladasInput } from '../services/financeiroService';
import { Plus, Loader2, CalendarDays, FileText, DollarSign, Tag, Landmark, Sparkles, X } from 'lucide-react';
import { createRuntimeId } from '../../../../lib/realtimeChannel';
import '../../faturamento/Faturamento.css';
import './AddContasAPagarModal.css';

// Bulletproof local default categories to fall back to if database is empty/loading
const LOCAL_DEFAULT_CATEGORIAS = [
  { nome: 'Aluguel / Condomínio', tipoDespesa: 'fixa' },
  { nome: 'Honorários Contábeis', tipoDespesa: 'fixa' },
  { nome: 'Salários e Prolabore', tipoDespesa: 'fixa' },
  { nome: 'Assinaturas de Software / SaaS', tipoDespesa: 'fixa' },
  { nome: 'Serviços de Terceiros (Fixos)', tipoDespesa: 'fixa' },
  { nome: 'Impostos e Taxas', tipoDespesa: 'variavel' },
  { nome: 'Marketing e Publicidade', tipoDespesa: 'variavel' },
  { nome: 'Comissões sobre Vendas', tipoDespesa: 'variavel' },
  { nome: 'Material de Escritório', tipoDespesa: 'variavel' },
  { nome: 'Manutenção / Reparos', tipoDespesa: 'variavel' },
  { nome: 'Viagens e Deslocamentos', tipoDespesa: 'variavel' },
];

type AddContasAPagarModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dados: any) => Promise<void>;
  onSubmitParcelado: (dados: ContasPagarParceladasInput) => Promise<void>;
  isLoading: boolean;
};

export const AddContasAPagarModal: React.FC<AddContasAPagarModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSubmitParcelado,
  isLoading,
}) => {
  const queryClient = useQueryClient();
  const { data: contas = [], isLoading: isLoadingContas } = useContasBancariasQuery();

  // Load financial categories
  const categoriesQuery = useQuery({
    queryKey: ['parametrizacao', 'catalogos', 'categorias_financeiras'],
    queryFn: categoriaFinanceiraService.getAll,
  });

  // Merge or fallback to ensure we always have active categories to select from!
  const categories = useMemo(() => {
    const dbCategories = categoriesQuery.data || [];
    return dbCategories.length > 0 ? dbCategories : LOCAL_DEFAULT_CATEGORIAS;
  }, [categoriesQuery.data]);

  // Form State
  const [tipoDespesa, setTipoDespesa] = useState<'fixa' | 'variavel'>('fixa');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valorTotal, setValorTotal] = useState(0);
  const [valorTotalStr, setValorTotalStr] = useState('R$ 0,00');
  const [dataCompetencia, setDataCompetencia] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'Pendente' | 'Pago'>('Pendente');
  const [contaBancariaId, setContaBancariaId] = useState('');
  
  // Installments state
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);

  // Inline Category Creator state
  const [showInlineCategoryForm, setShowInlineCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [inlineCategoryError, setInlineCategoryError] = useState('');
  const [formError, setFormError] = useState('');
  const [idempotencyKey] = useState(() => createRuntimeId('installments'));

  // Auto-select first matching category when list or type changes
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.tipoDespesa === tipoDespesa),
    [categories, tipoDespesa],
  );

  useEffect(() => {
    if (filteredCategories.length > 0) {
      setCategoria(filteredCategories[0].nome);
    } else {
      setCategoria('');
    }
  }, [filteredCategories]);

  // Clean form when opening
  useEffect(() => {
    if (isOpen) {
      setTipoDespesa('fixa');
      setDescricao('');
      setValorTotal(0);
      setValorTotalStr('R$ 0,00');
      setDataCompetencia(new Date().toISOString().slice(0, 10));
      setDataVencimento(new Date().toISOString().slice(0, 10));
      setStatus('Pendente');
      setContaBancariaId('');
      setParcelado(false);
      setNumParcelas(2);
      setShowInlineCategoryForm(false);
      setNewCategoryName('');
      setInlineCategoryError('');
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrencyValue = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/\D/g, '');
    const cents = parseInt(clean, 10) || 0;
    const numericValue = cents / 100;
    setValorTotal(numericValue);
    setValorTotalStr(formatCurrencyValue(numericValue));
  };

  // Inline Category Submit
  const handleCreateCategoryInline = async () => {
    setInlineCategoryError('');
    const name = newCategoryName.trim();
    if (!name) {
      setInlineCategoryError('O nome é obrigatório.');
      return;
    }
    
    setIsCreatingCategory(true);
    try {
      await categoriaFinanceiraService.save(name, tipoDespesa);
      await queryClient.invalidateQueries({ queryKey: ['parametrizacao', 'catalogos', 'categorias_financeiras'] });
      setNewCategoryName('');
      setShowInlineCategoryForm(false);
      setCategoria(name); // select newly created category
    } catch (err: any) {
      setInlineCategoryError(err.message || 'Erro ao criar categoria.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (valorTotal <= 0) {
      setFormError('Favor preencher o valor do lançamento.');
      return;
    }

    try {
      if (parcelado && numParcelas >= 2) {
      await onSubmitParcelado({
        idempotencyKey,
          tipoDespesa,
          descricao: descricao.trim(),
          categoria,
          valorTotal,
          dataCompetencia,
          dataVencimento,
          status,
          contaBancariaId: status === 'Pago' && contaBancariaId ? contaBancariaId : undefined,
          numeroParcelas: numParcelas,
        });
      } else {
        await onSubmit({
          tipo: 'despesa',
          origem: 'conta_pagar',
          descricao: descricao.trim(),
          categoria,
          valor: valorTotal,
          dataCompetencia: dataVencimento,
          dataPagamento: status === 'Pago' ? dataCompetencia : undefined,
          status,
          contaBancariaId: status === 'Pago' && contaBancariaId ? contaBancariaId : undefined,
          metadados: { tipoDespesa, dataCompetencia },
        });
      }
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao registrar contas a pagar.');
    }
  };

  const modalContent = (
    <div className="faturamento-modal-backdrop animate-fade-in">
      <div className="faturamento-card faturamento-charge-modal" style={{ maxWidth: '640px' }}>
        
        {/* Header */}
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <h2>Novo contas a pagar</h2>
              <p>Registre despesas fixas ou variáveis e configure o parcelamento ou a baixa automática.</p>
            </div>
          </div>
          <button onClick={onClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Form Body using faturamento grid layout */}
        <form onSubmit={handleSubmit} className="faturamento-charge-form">
          
          <div className="faturamento-form-group">
            <label>Tipo de Despesa</label>
            <div className="segmented-control">
              <button
                type="button"
                className={tipoDespesa === 'fixa' ? 'active' : ''}
                onClick={() => setTipoDespesa('fixa')}
              >
                Despesa Fixa
              </button>
              <button
                type="button"
                className={tipoDespesa === 'variavel' ? 'active' : ''}
                onClick={() => setTipoDespesa('variavel')}
              >
                Despesa Variável
              </button>
            </div>
          </div>

          <div className="faturamento-form-group">
            <label>Status do Pagamento</label>
            <div className="segmented-control">
              <button
                type="button"
                className={status === 'Pendente' ? 'active' : ''}
                onClick={() => setStatus('Pendente')}
              >
                Em Aberto
              </button>
              <button
                type="button"
                className={status === 'Pago' ? 'active status-pago' : ''}
                onClick={() => setStatus('Pago')}
              >
                Pago (Baixar Agora)
              </button>
            </div>
          </div>

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição / Credor</label>
            <div className="faturamento-input-with-icon">
              <FileText size={16} />
              <input
                type="text"
                required
                placeholder="Ex: Fornecedor de insumos, Energia Elétrica, Aluguel"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          </div>

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={{ margin: 0 }}>Categoria</label>
              <button 
                type="button" 
                onClick={() => setShowInlineCategoryForm(prev => !prev)}
                style={{ background: 'none', border: 'none', color: '#c59235', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} />
                Criar Nova Categoria
              </button>
            </div>

            {showInlineCategoryForm ? (
              <div className="category-inline-creator">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={`Nova categoria ${tipoDespesa === 'fixa' ? 'fixa' : 'variável'}...`}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    style={{ flex: 1, height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 12px', fontSize: '0.85rem' }}
                    disabled={isCreatingCategory}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateCategoryInline();
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={handleCreateCategoryInline}
                    disabled={isCreatingCategory}
                    style={{ padding: '0 16px', background: '#c59235', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    {isCreatingCategory ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar'}
                  </button>
                </div>
                {inlineCategoryError && (
                  <span style={{ display: 'block', color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>{inlineCategoryError}</span>
                )}
              </div>
            ) : null}

            <div className="faturamento-input-with-icon">
              <Tag size={16} />
              <select 
                value={categoria} 
                onChange={(e) => setCategoria(e.target.value)}
                required
              >
                {filteredCategories.length === 0 && <option value="">Nenhuma categoria encontrada</option>}
                {filteredCategories.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '14px' }}>
              
              <div className="faturamento-form-group" style={{ margin: 0 }}>
                <label>Valor do Lançamento</label>
                <div className="faturamento-input-with-icon" style={{ borderLeft: '4px solid #c59235' }}>
                  <DollarSign size={16} />
                  <input
                    type="text"
                    required
                    style={{ fontWeight: 800 }}
                    value={valorTotalStr}
                    onChange={handleValorChange}
                  />
                </div>
              </div>

              <div className="faturamento-form-group" style={{ margin: 0 }}>
                <label>Data</label>
                <div className="faturamento-input-with-icon">
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    required
                    value={dataCompetencia}
                    onChange={(e) => setDataCompetencia(e.target.value)}
                  />
                </div>
              </div>

              <div className="faturamento-form-group" style={{ margin: 0 }}>
                <label>Data de Vencimento</label>
                <div className="faturamento-input-with-icon">
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    required
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Conditional field row */}
          {status === 'Pago' ? (
            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Conta de Origem (Saída)</label>
              <div className="faturamento-input-with-icon">
                <Landmark size={16} />
                <select
                  value={contaBancariaId}
                  onChange={(e) => setContaBancariaId(e.target.value)}
                  required
                  disabled={isLoadingContas}
                >
                  <option value="">Selecione a conta bancária...</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.banco} ({formatCurrencyValue(conta.saldoAtual ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Opções de Parcelamento</label>
              <div 
                className="custom-toggle-row" 
                onClick={() => setParcelado(!parcelado)}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Lançamento Parcelado (Dividir em parcelas mensais)</span>
                <div className={`toggle-switch-track ${parcelado ? 'active' : ''}`}>
                  <div className="toggle-switch-handle"></div>
                </div>
              </div>
            </div>
          )}

          {/* Installments panel container */}
          {parcelado && status === 'Pendente' && (
            <div style={{ gridColumn: '1 / -1', padding: '16px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: '12px' }} className="animate-fade-in">
              <div className="faturamento-form-group" style={{ maxWidth: '160px', margin: 0 }}>
                <label style={{ color: '#92400e' }}>Nº de Parcelas</label>
                <div className="faturamento-input-with-icon" style={{ background: '#ffffff', minHeight: '40px' }}>
                  <input
                    type="number"
                    min={2}
                    max={36}
                    value={numParcelas}
                    style={{ height: '38px' }}
                    onChange={(e) => setNumParcelas(Math.max(2, parseInt(e.target.value, 10) || 2))}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#92400e', fontWeight: 700, lineHeight: '1.4' }}>
                Serão gerados {numParcelas} lançamentos mensais de {formatCurrencyValue(valorTotal / numParcelas)} cada, com vencimentos consecutivos a partir de {dataVencimento.split('-').reverse().join('/')}.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          {formError && <div className="financeiro-form-error" role="alert" style={{ gridColumn: '1 / -1' }}>{formError}</div>}
          <div className="faturamento-modal-actions" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid #cbd5e1', paddingTop: '16px', background: 'transparent' }}>
            <button type="button" onClick={onClose} disabled={isLoading} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', cursor: 'pointer', height: '40px', padding: '0 18px', borderRadius: '6px', fontWeight: 700 }}>
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{ backgroundColor: '#c59235', color: '#ffffff', border: 'none', padding: '0 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', height: '40px' }}
            >
              {isLoading ? 'Registrando...' : 'Confirmar Lançamento'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
