import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useContasBancariasQuery } from '../../configuracoes/contas-bancarias/queries/useContasBancariasQueries';
import { CalendarDays, FileText, DollarSign, Landmark, Sparkles, X } from 'lucide-react';
import '../../faturamento/Faturamento.css';
import './AddContasAPagarModal.css';

type AddTransferenciaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dados: {
    data: string;
    valor: number;
    contaOrigemId: string;
    contaDestinoId: string;
    nomeContaOrigem: string;
    nomeContaDestino: string;
    descricao: string;
  }) => Promise<void>;
  isLoading: boolean;
};

export const AddTransferenciaModal: React.FC<AddTransferenciaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const { data: contas = [], isLoading: isLoadingContas } = useContasBancariasQuery();

  // Form State
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState(0);
  const [valorStr, setValorStr] = useState('R$ 0,00');
  const [contaOrigemId, setContaOrigemId] = useState('');
  const [contaDestinoId, setContaDestinoId] = useState('');
  const [descricao, setDescricao] = useState('Transferência entre contas');

  // Clean form when opening
  useEffect(() => {
    if (isOpen) {
      setData(new Date().toISOString().slice(0, 10));
      setValor(0);
      setValorStr('R$ 0,00');
      setContaOrigemId('');
      setContaDestinoId('');
      setDescricao('Transferência entre contas');
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
    setValor(numericValue);
    setValorStr(formatCurrencyValue(numericValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (valor <= 0) {
      alert('Favor preencher o valor da transferência.');
      return;
    }
    if (!contaOrigemId || !contaDestinoId) {
      alert('Selecione ambas as contas (origem e destino).');
      return;
    }
    if (contaOrigemId === contaDestinoId) {
      alert('A conta de destino deve ser diferente da conta de origem.');
      return;
    }

    const contaOrigem = contas.find((c) => c.id === contaOrigemId);
    const contaDestino = contas.find((c) => c.id === contaDestinoId);

    if (!contaOrigem || !contaDestino) {
      alert('Conta não localizada.');
      return;
    }

    await onSubmit({
      data,
      valor,
      contaOrigemId,
      contaDestinoId,
      nomeContaOrigem: contaOrigem.banco,
      nomeContaDestino: contaDestino.banco,
      descricao: descricao.trim() || 'Transferência entre contas',
    });

    onClose();
  };

  const modalContent = (
    <div className="faturamento-modal-backdrop animate-fade-in">
      <div className="faturamento-card faturamento-charge-modal" style={{ maxWidth: '600px' }}>
        
        {/* Header */}
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <h2>Transferência entre Contas</h2>
              <p>Transfira saldos entre contas bancárias internas de forma simplificada.</p>
            </div>
          </div>
          <button onClick={onClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="faturamento-charge-form">
          
          <div className="faturamento-form-group">
            <label>Data</label>
            <div className="faturamento-input-with-icon">
              <CalendarDays size={16} />
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="faturamento-form-group">
            <label>Valor (R$)</label>
            <div className="faturamento-input-with-icon" style={{ borderLeft: '4px solid var(--color-gold-primary)' }}>
              <DollarSign size={16} />
              <input
                type="text"
                required
                style={{ fontWeight: 800 }}
                value={valorStr}
                onChange={handleValorChange}
              />
            </div>
          </div>

          <div className="faturamento-form-group">
            <label>Conta de Origem (Saída)</label>
            <div className="faturamento-input-with-icon">
              <Landmark size={16} />
              <select
                value={contaOrigemId}
                onChange={(e) => setContaOrigemId(e.target.value)}
                required
                disabled={isLoadingContas}
              >
                <option value="">Selecione...</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.banco} ({formatCurrencyValue(conta.saldoAtual ?? 0)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="faturamento-form-group">
            <label>Conta de Destino (Entrada)</label>
            <div className="faturamento-input-with-icon">
              <Landmark size={16} />
              <select
                value={contaDestinoId}
                onChange={(e) => setContaDestinoId(e.target.value)}
                required
                disabled={isLoadingContas}
              >
                <option value="">Selecione...</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.banco} ({formatCurrencyValue(conta.saldoAtual ?? 0)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição / Observação</label>
            <div className="faturamento-input-with-icon">
              <FileText size={16} />
              <input
                type="text"
                required
                placeholder="Ex: Transferência da conta corrente para aplicação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="faturamento-modal-actions" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid #cbd5e1', paddingTop: '16px', background: 'transparent' }}>
            <button type="button" onClick={onClose} disabled={isLoading} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', cursor: 'pointer', height: '40px', padding: '0 18px', borderRadius: '6px', fontWeight: 700 }}>
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{ backgroundColor: '#c59235', color: '#ffffff', border: 'none', padding: '0 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', height: '40px' }}
            >
              {isLoading ? 'Registrando...' : 'Confirmar Transferência'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
