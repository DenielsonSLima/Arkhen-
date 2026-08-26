import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  DollarSign,
  FileText,
  Percent,
  ReceiptText,
} from 'lucide-react';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  BillingClientSelect,
  BillingInputFrame,
  BillingSectionTitle,
  formatCurrencyInput,
  formatPercentInput,
  parseCurrencyInput,
  parsePercentInput,
} from './billingFormUtils';
import { getTodayString, type MeioPagamento, type NovoLancamentoTipo } from './novoLancamentoAvulsoModel';

const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface LancamentoTypeChoiceProps {
  tipo: NovoLancamentoTipo;
  onChange: (tipo: NovoLancamentoTipo) => void;
}

export const LancamentoTypeChoice = ({ tipo, onChange }: LancamentoTypeChoiceProps) => (
  <div className="faturamento-charge-choice">
    <button
      type="button"
      onClick={() => onChange('cobranca')}
      className={`faturamento-charge-type ${tipo === 'cobranca' ? 'active' : ''}`}
    >
      <span className="faturamento-charge-type-icon">
        <DollarSign size={24} />
      </span>
      <span>
        <strong>Apenas cobrança</strong>
        <small>Gerar boleto, Pix ou checkout de pagamento sem nota fiscal.</small>
      </span>
    </button>
    <button
      type="button"
      onClick={() => onChange('nfse')}
      className={`faturamento-charge-type ${tipo === 'nfse' ? 'active' : ''}`}
      disabled
      title="Indisponível: ainda não existe integração fiscal direta para emitir NFS-e sem uma cobrança vinculada."
    >
      <span className="faturamento-charge-type-icon">
        <FileText size={24} />
      </span>
      <span>
        <strong>Somente NFS-e</strong>
        <small>Indisponível enquanto não houver integração fiscal direta sem cobrança.</small>
      </span>
    </button>
    <button
      type="button"
      onClick={() => onChange('nfseComCobranca')}
      className={`faturamento-charge-type ${tipo === 'nfseComCobranca' ? 'active' : ''}`}
    >
      <span className="faturamento-charge-type-icon">
        <ReceiptText size={24} />
      </span>
      <span>
        <strong>NFS-e + cobrança</strong>
        <small>Criar a cobrança no financeiro e emitir a NFS-e vinculada a ela.</small>
      </span>
    </button>
  </div>
);

interface LancamentoDetailsFormProps {
  clientes: Company[];
  isLoadingClientes: boolean;
  clienteEmpresaId: string;
  valor: string;
  dataVencimento: string;
  descricao: string;
  meioPagamento: MeioPagamento;
  descontoPercentual: string;
  jurosPercentual: string;
  multaPercentual: string;
  mensagemBoleto: string;
  onClienteChange: (value: string) => void;
  onValorChange: (value: string) => void;
  onDataVencimentoChange: (value: string) => void;
  onDescricaoChange: (value: string) => void;
  onMeioPagamentoChange: (value: MeioPagamento) => void;
  onDescontoChange: (value: string) => void;
  onJurosChange: (value: string) => void;
  onMultaChange: (value: string) => void;
  onMensagemBoletoChange: (value: string) => void;
}

export const LancamentoDetailsForm = ({
  clientes,
  isLoadingClientes,
  clienteEmpresaId,
  valor,
  dataVencimento,
  descricao,
  meioPagamento,
  descontoPercentual,
  jurosPercentual,
  multaPercentual,
  mensagemBoleto,
  onClienteChange,
  onValorChange,
  onDataVencimentoChange,
  onDescricaoChange,
  onMeioPagamentoChange,
  onDescontoChange,
  onJurosChange,
  onMultaChange,
  onMensagemBoletoChange,
}: LancamentoDetailsFormProps) => (
  <div className="faturamento-charge-form">
    <BillingSectionTitle title="Dados principais" description="Cliente, valor e descrição da cobrança." />

    <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
      <label>Parceiro / Cliente</label>
      <BillingClientSelect
        clientes={clientes}
        value={clienteEmpresaId}
        onChange={onClienteChange}
        isLoading={isLoadingClientes}
      />
    </div>

    <div className="faturamento-form-group">
      <label>Valor (R$)</label>
      <BillingInputFrame icon={<Banknote size={16} />}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={valor}
          onChange={(event) => onValorChange(formatCurrencyInput(event.target.value))}
        />
      </BillingInputFrame>
    </div>

    <div className="faturamento-form-group">
      <label>Data de vencimento</label>
      <BillingInputFrame icon={<CalendarDays size={16} />}>
        <input
          type="date"
          value={dataVencimento}
          onChange={(event) => onDataVencimentoChange(event.target.value)}
        />
      </BillingInputFrame>
      {dataVencimento === getTodayString() && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontSize: '0.72rem', fontWeight: 600, marginTop: '4px' }}>
          <AlertTriangle size={12} /> Vencimento hoje. Altere se necessário.
        </span>
      )}
    </div>

    <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
      <label>Descrição</label>
      <BillingInputFrame icon={<FileText size={16} />}>
        <input
          type="text"
          placeholder="Ex: Honorários contábeis, consultoria, regularização..."
          value={descricao}
          onChange={(event) => onDescricaoChange(event.target.value)}
        />
      </BillingInputFrame>
    </div>

    <BillingSectionTitle
      title="Pagamento e regras do boleto"
      description="Configure desconto, juros e multa enviados ao Banco Inter."
    />

    <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
      <label>Forma de Pagamento</label>
      <select
        value={meioPagamento}
        onChange={(event) => onMeioPagamentoChange(event.target.value as MeioPagamento)}
      >
        <option value="Ambos">Boleto + Pix</option>
        <option value="Pix">Apenas Pix</option>
        <option value="Boleto">Boleto</option>
      </select>
    </div>

    <div className="faturamento-form-group">
      <label>Desconto até o vencimento (%)</label>
      <BillingInputFrame icon={<Percent size={16} />}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={descontoPercentual}
          onChange={(event) => onDescontoChange(formatPercentInput(event.target.value))}
        />
      </BillingInputFrame>
    </div>

    <div className="faturamento-form-group">
      <label>Juros ao mês (%)</label>
      <BillingInputFrame icon={<Percent size={16} />}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={jurosPercentual}
          onChange={(event) => onJurosChange(formatPercentInput(event.target.value))}
        />
      </BillingInputFrame>
    </div>

    <div className="faturamento-form-group">
      <label>Multa após vencimento (%)</label>
      <BillingInputFrame icon={<Percent size={16} />}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={multaPercentual}
          onChange={(event) => onMultaChange(formatPercentInput(event.target.value))}
        />
      </BillingInputFrame>
    </div>

    <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
      <label>Mensagem no boleto</label>
      <textarea
        rows={2}
        maxLength={220}
        placeholder="Ex: Após o vencimento, cobrar juros e multa conforme contrato."
        value={mensagemBoleto}
        onChange={(event) => onMensagemBoletoChange(event.target.value)}
      />
    </div>

    {(parsePercentInput(descontoPercentual) > 0
      || parsePercentInput(multaPercentual) > 0
      || parsePercentInput(jurosPercentual) > 0)
      && parseCurrencyInput(valor) > 0 && (
      <div className="faturamento-form-group" style={{ gridColumn: '1 / -1', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
          Simulação de Valores:
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {parsePercentInput(descontoPercentual) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#475569' }}>Valor com desconto (até o vencimento):</span>
              <strong style={{ color: '#16a34a' }}>
                {formatCurrency(parseCurrencyInput(valor) * (1 - parsePercentInput(descontoPercentual)))}
              </strong>
            </div>
          )}
          {(parsePercentInput(multaPercentual) > 0 || parsePercentInput(jurosPercentual) > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#475569' }}>Valor após o vencimento (com multa e juros/mês):</span>
              <strong style={{ color: '#dc2626' }}>
                {formatCurrency(
                  parseCurrencyInput(valor)
                    + (parseCurrencyInput(valor) * parsePercentInput(multaPercentual))
                    + (parseCurrencyInput(valor) * parsePercentInput(jurosPercentual)),
                )}
              </strong>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
