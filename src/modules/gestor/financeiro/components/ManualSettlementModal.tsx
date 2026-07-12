import React, { useState, useEffect } from 'react';
import { FormCard } from '../forms/FormCard';
import { useContasBancariasQuery } from '../../configuracoes/contas-bancarias/queries/useContasBancariasQueries';
import './ManualSettlementModal.css';

type SettlementData = {
  dataPagamento: string;
  formaPagamento: string;
  valorRecebido: number;
  desconto: number;
  juros: number;
  observacao: string;
  baixarParcial: boolean;
  contaBancariaId?: string;
};

type ManualSettlementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  cobranca: {
    id: string;
    valor: number;
    descricao: string;
    pagadorNome: string;
    pagadorCnpj: string;
    dataVencimento: string;
    dataVencimentoFormatted: string;
  };
  onSubmit: (data: SettlementData) => Promise<void>;
  isLoading: boolean;
};

export const ManualSettlementModal: React.FC<ManualSettlementModalProps> = ({
  isOpen,
  onClose,
  cobranca,
  onSubmit,
  isLoading,
}) => {
  const { data: contas = [], isLoading: isLoadingContas } = useContasBancariasQuery();

  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [baixarParcial, setBaixarParcial] = useState(false);
  const [valorRecebido, setValorRecebido] = useState(cobranca?.valor || 0);
  const [desconto, setDesconto] = useState(0);
  const [juros, setJuros] = useState(0);
  const [observacao, setObservacao] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (cobranca) {
      setValorRecebido(cobranca.valor);
      setDesconto(0);
      setJuros(0);
      setObservacao('');
      setBaixarParcial(false);
      setValidationError(null);
    }
  }, [cobranca]);

  if (!isOpen || !cobranca) {
    return null;
  }

  // Pre-fill default bank account if accounts exist
  if (!contaBancariaId && contas.length > 0) {
    setContaBancariaId(contas[0].id);
  }

  const formatCurrencyInput = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parseCurrencyInput = (valStr: string) => {
    const clean = valStr.replace(/\D/g, '');
    const cents = parseInt(clean, 10) || 0;
    return cents / 100;
  };

  // Live preview calculation
  // Total debt reduction = valor_recebido + desconto - juros
  const totalAbatido = valorRecebido + desconto - juros;
  const saldoRestante = Math.max(0, cobranca.valor - totalAbatido);
  const liquidado = totalAbatido >= cobranca.valor;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (valorRecebido <= 0 && desconto <= 0) {
      setValidationError('Favor inserir um valor de recebimento ou desconto válido.');
      return;
    }

    void onSubmit({
      dataPagamento,
      formaPagamento,
      valorRecebido,
      desconto,
      juros,
      observacao: observacao.trim(),
      baixarParcial: baixarParcial && !liquidado, // se o abatimento liquidar tudo, baixa como total
      contaBancariaId: contaBancariaId || undefined,
    });
  };

  return (
    <FormCard title="Registrar Baixa Manual" onClose={onClose} containerMaxWidth="620px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Ticket Header - Immersive Design */}
        <div className="manual-settlement-receipt-card">
          <div className="receipt-header-row">
            <div className="receipt-pagador-col">
              <span className="label-receipt">Parceiro Pagador</span>
              <strong title={cobranca.pagadorNome}>
                {cobranca.pagadorNome}
              </strong>
              <span>CNPJ {cobranca.pagadorCnpj || '-'}</span>
            </div>
            <div className="receipt-vencimento-col">
              <span className="label-receipt">Vencimento</span>
              <strong>{cobranca.dataVencimentoFormatted}</strong>
            </div>
          </div>
          <div className="receipt-bottom-row">
            <div className="receipt-service-col">
              <span className="label-receipt">Serviço</span>
              <span title={cobranca.descricao}>
                {cobranca.descricao}
              </span>
            </div>
            <div className="receipt-valor-col">
              <span className="label-receipt">Valor em Aberto</span>
              <strong>
                {cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>
        </div>

        <div className="financeiro-form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="financeiro-field">
            <label>Data de Recebimento</label>
            <input
              type="date"
              required
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>

          <div className="financeiro-field">
            <label>Forma de Recebimento</label>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
              <option value="Pix">Pix</option>
              <option value="Boleto">Boleto Bancário</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Transferência">Transferência Bancária</option>
            </select>
          </div>

          <div className="financeiro-field">
            <label>Conta Bancária Destino</label>
            <select 
              value={contaBancariaId} 
              onChange={(e) => setContaBancariaId(e.target.value)}
              disabled={isLoadingContas}
            >
              <option value="">Não registrar no saldo bancário</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.banco} - Ag. {conta.agencia} Conta {conta.numeroConta}
                </option>
              ))}
            </select>
          </div>

          <div className="financeiro-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
            <div className="settlement-partial-toggle">
              <input
                type="checkbox"
                id="baixarParcial"
                checked={baixarParcial}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setBaixarParcial(checked);
                  if (!checked) {
                    setValorRecebido(cobranca.valor);
                    setDesconto(0);
                    setJuros(0);
                  }
                }}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="baixarParcial" style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                Baixa Parcial (Recebimento em pedaços)
              </label>
            </div>
          </div>
        </div>

        <div className="financeiro-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="financeiro-field">
            <label>Valor Recebido</label>
            <input
              type="text"
              required
              value={formatCurrencyInput(valorRecebido)}
              onChange={(e) => setValorRecebido(parseCurrencyInput(e.target.value))}
              disabled={!baixarParcial}
            />
          </div>

          <div className="financeiro-field">
            <label>Desconto</label>
            <input
              type="text"
              value={formatCurrencyInput(desconto)}
              onChange={(e) => setDesconto(parseCurrencyInput(e.target.value))}
              disabled={!baixarParcial}
            />
          </div>

          <div className="financeiro-field">
            <label>Juros/Multa</label>
            <input
              type="text"
              value={formatCurrencyInput(juros)}
              onChange={(e) => setJuros(parseCurrencyInput(e.target.value))}
              disabled={!baixarParcial}
            />
          </div>
        </div>

        <div className="financeiro-field">
          <label>Observações / Histórico</label>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Digite detalhes da transação..."
          />
        </div>

        {/* Live Preview Summary */}
        <div className="settlement-live-preview">
          <div className="settlement-live-row">
            <span>Total Abatido da Dívida:</span>
            <strong>{totalAbatido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </div>
          <div className="settlement-live-row bold">
            <span>Saldo Devedor Restante:</span>
            <span>
              {liquidado ? (
                <span className="badge-liquidated">
                  Liquidado (Baixa Total)
                </span>
              ) : (
                saldoRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              )}
            </span>
          </div>
        </div>

        {validationError && (
          <div className="financeiro-form-error" style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
            {validationError}
          </div>
        )}

        <div className="financeiro-form-actions" style={{ marginTop: '8px' }}>
          <button type="button" className="financeiro-form-btn secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </button>
          <button type="submit" className="financeiro-form-btn" disabled={isLoading}>
            {isLoading ? 'Registrando...' : 'Confirmar Baixa'}
          </button>
        </div>
      </form>
    </FormCard>
  );
};
