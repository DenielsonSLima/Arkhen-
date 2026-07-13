import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, Info } from 'lucide-react';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import type { ContaBancaria } from '../../configuracoes/contas-bancarias/services/contasBancariasService';

type ModalPagarDespesaProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dados: {
    lancamentoId: string;
    contaBancariaId: string;
    dataPagamento: string;
    valorPago: number;
    desconto: number;
    juros: number;
    observacao: string;
  }) => Promise<void>;
  despesa: LancamentoFinanceiro | null;
  contasBancarias: ContaBancaria[];
  isLoading?: boolean;
};

export const ModalPagarDespesa: React.FC<ModalPagarDespesaProps> = ({
  isOpen,
  onClose,
  onSubmit,
  despesa,
  contasBancarias,
  isLoading = false,
}) => {
  const getTodayString = () => new Date().toISOString().slice(0, 10);

  const [dataPagamento, setDataPagamento] = useState(getTodayString());
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [descontoInput, setDescontoInput] = useState('');
  const [jurosInput, setJurosInput] = useState('');
  const [valorPagoInput, setValorPagoInput] = useState('');
  const [observacao, setObservacao] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize values when despesa changes or modal opens
  useEffect(() => {
    if (isOpen && despesa) {
      setDataPagamento(getTodayString());
      setDescontoInput('0,00');
      setJurosInput('0,00');
      setValorPagoInput(despesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setObservacao('');
      setErrorMsg(null);
      
      // Auto-select first account if available
      if (contasBancarias.length > 0) {
        setContaBancariaId(contasBancarias[0].id);
      } else {
        setContaBancariaId('');
      }
    }
  }, [isOpen, despesa, contasBancarias]);

  if (!isOpen || !despesa) return null;

  const parseNumber = (value: string): number => {
    const clean = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrencyInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '0,00';
    const cents = parseInt(clean, 10);
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Handle changes and recalculate valorPago
  const handleDescontoChange = (val: string) => {
    const formatted = formatCurrencyInput(val);
    setDescontoInput(formatted);
    const desc = parseNumber(formatted);
    const juros = parseNumber(jurosInput);
    const finalVal = Math.max(0, despesa.valor - desc + juros);
    setValorPagoInput(finalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleJurosChange = (val: string) => {
    const formatted = formatCurrencyInput(val);
    setJurosInput(formatted);
    const juros = parseNumber(formatted);
    const desc = parseNumber(descontoInput);
    const finalVal = Math.max(0, despesa.valor - desc + juros);
    setValorPagoInput(finalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaBancariaId) {
      setErrorMsg('Favor selecionar a conta bancária de origem.');
      return;
    }
    if (!dataPagamento) {
      setErrorMsg('Favor preencher a data de pagamento.');
      return;
    }
    const valPago = parseNumber(valorPagoInput);
    if (valPago <= 0) {
      setErrorMsg('O valor pago deve ser maior que zero.');
      return;
    }

    try {
      setErrorMsg(null);
      await onSubmit({
        lancamentoId: despesa.id,
        contaBancariaId,
        dataPagamento,
        valorPago: valPago,
        desconto: parseNumber(descontoInput),
        juros: parseNumber(jurosInput),
        observacao: observacao.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao registrar pagamento.');
    }
  };

  return createPortal(
    <div className="faturamento-modal-backdrop animate-fade-in" style={{ zIndex: 1000 }}>
      <div className="faturamento-card faturamento-charge-modal" style={{ maxWidth: '520px', width: '100%' }}>
        
        {/* Header */}
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon" style={{ backgroundColor: '#fff7df', color: '#c59235' }}>
              <DollarSign size={18} />
            </span>
            <div>
              <h3>Registrar Pagamento</h3>
              <p>Confirme a saída em conta da despesa</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="faturamento-modal-close" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="faturamento-modal-body">
          {errorMsg && (
            <div className="faturamento-error-alert" style={{ marginBottom: '16px' }}>
              <Info size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Despesa Info Card */}
          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Despesa Selecionada
            </span>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a', display: 'block' }}>{despesa.descricao}</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: '#475569' }}>
              <span>Valor Original: <strong>{despesa.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
              <span>Vencimento: <strong>{new Date(despesa.dataCompetencia + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
            </div>
          </div>

          <div className="faturamento-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            
            {/* Conta Bancária */}
            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Conta de Origem</label>
              <select
                value={contaBancariaId}
                onChange={(e) => setContaBancariaId(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #dbe3ee',
                  padding: '0 12px',
                  fontSize: '0.86rem',
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              >
                <option value="" disabled>Selecione a conta bancária...</option>
                {contasBancarias.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.banco} (Ag: {conta.agencia} | Cc: {conta.numeroConta}) - Saldo: {conta.saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Pagamento */}
            <div className="faturamento-form-group">
              <label>Data do Pagamento</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '8px',
                    border: '1px solid #dbe3ee',
                    padding: '0 12px',
                    fontSize: '0.86rem',
                    color: '#0f172a',
                  }}
                />
              </div>
            </div>

            {/* Desconto */}
            <div className="faturamento-form-group">
              <label>Desconto (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={descontoInput}
                onChange={(e) => handleDescontoChange(e.target.value)}
                placeholder="0,00"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #dbe3ee',
                  padding: '0 12px',
                  fontSize: '0.86rem',
                  color: '#16a34a',
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Juros */}
            <div className="faturamento-form-group">
              <label>Juros / Multa (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={jurosInput}
                onChange={(e) => handleJurosChange(e.target.value)}
                placeholder="0,00"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #dbe3ee',
                  padding: '0 12px',
                  fontSize: '0.86rem',
                  color: '#dc2626',
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Valor Pago */}
            <div className="faturamento-form-group">
              <label>Valor Total Pago (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={valorPagoInput}
                onChange={(e) => setValorPagoInput(formatCurrencyInput(e.target.value))}
                placeholder="0,00"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid #dbe3ee',
                  padding: '0 12px',
                  fontSize: '0.86rem',
                  color: '#0f172a',
                  fontWeight: 700,
                  backgroundColor: '#f8fafc',
                }}
              />
            </div>

            {/* Observações */}
            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Observações / Comprovante</label>
              <textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Opcional: Ex: Pago com Pix, comprovante arquivado."
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #dbe3ee',
                  padding: '10px 12px',
                  fontSize: '0.86rem',
                  color: '#0f172a',
                  resize: 'none',
                }}
              />
            </div>

          </div>

          {/* Footer Actions */}
          <div className="faturamento-modal-footer" style={{ marginTop: '20px', padding: '16px 0 0', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #dbe3ee',
                background: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: '40px',
                padding: '0 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#c59235',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(197, 146, 53, 0.2)',
              }}
            >
              {isLoading ? 'Confirmando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};
