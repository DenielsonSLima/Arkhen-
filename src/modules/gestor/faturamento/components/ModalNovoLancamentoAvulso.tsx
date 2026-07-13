import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Clipboard,
  DollarSign,
  ExternalLink,
  FileText,
  MessageCircle,
  Percent,
  Plus,
  ReceiptText,
  Share2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useCreateCobrancaFinanceiraMutation } from '../../financeiro/queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../../financeiro/services/financeiroService';
import {
  BillingClientSelect,
  BillingInputFrame,
  BillingSectionTitle,
  formatCurrencyInput,
  formatPercentInput,
  parseCurrencyInput,
  parsePercentInput,
} from './billingFormUtils';
import {
  buildCobrancaShareMessage,
  copyTextToClipboard,
  getCobrancaPaymentLink,
  getPublicCobrancaLink,
} from '../cobrancas/utils/cobrancaLinks';

interface ModalNovoLancamentoAvulsoProps {
  isOpen: boolean;
  onClose: () => void;
}

const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const ModalNovoLancamentoAvulso: React.FC<ModalNovoLancamentoAvulsoProps> = ({ isOpen, onClose }) => {
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: isOpen,
  });
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<'cobranca' | null>('cobranca');
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(getTodayString());
  const [descricao, setDescricao] = useState('');
  const [meioPagamento, setMeioPagamento] = useState<'Pix' | 'Boleto' | 'Ambos'>('Ambos');
  const [descontoPercentual, setDescontoPercentual] = useState('');
  const [jurosPercentual, setJurosPercentual] = useState('');
  const [multaPercentual, setMultaPercentual] = useState('');
  const [mensagemBoleto, setMensagemBoleto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCobranca, setGeneratedCobranca] = useState<CobrancaFinanceira | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  if (!isOpen) return null;

  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  const selectedCliente = (clientesQuery.data || []).find((cliente) => cliente.id === clienteEmpresaId);
  const asaasPaymentLink = generatedCobranca ? getCobrancaPaymentLink(generatedCobranca) : '';
  const paymentLink = generatedCobranca ? getPublicCobrancaLink(generatedCobranca, selectedCliente) : '';
  const shareText = generatedCobranca ? buildCobrancaShareMessage(generatedCobranca, selectedCliente) : '';

  const resetForm = () => {
    setStep(1);
    setTipo('cobranca');
    setClienteEmpresaId('');
    setValor('');
    setDataVencimento(getTodayString());
    setDescricao('');
    setMeioPagamento('Ambos');
    setDescontoPercentual('');
    setJurosPercentual('');
    setMultaPercentual('');
    setMensagemBoleto('');
    setErrorMsg(null);
    setGeneratedCobranca(null);
    setCopyStatus('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const copyToClipboard = async (content: string, message: string) => {
    if (!content) return;
    try {
      await copyTextToClipboard(content);
      setCopyStatus(message);
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Não foi possível copiar automaticamente.');
      window.setTimeout(() => setCopyStatus(''), 2600);
    }
  };

  const handleShare = async () => {
    if (!shareText) return;
    if (navigator.share) {
      await navigator.share({ title: 'Cobrança Asaas', text: shareText, url: paymentLink || undefined });
      return;
    }
    await copyToClipboard(shareText, 'Mensagem copiada para compartilhar.');
  };

  const handleSubmit = async () => {
    const parsedValor = parseCurrencyInput(valor);
    if (!clienteEmpresaId || parsedValor <= 0 || !dataVencimento) {
      setErrorMsg('Selecione o parceiro, valor e data.');
      return;
    }

    try {
      setErrorMsg(null);
      const cobranca = await createCobrancaMutation.mutateAsync({
        clienteEmpresaId,
        valor: parsedValor,
        dataVencimento,
        descricao: descricao.trim() || 'Cobrança avulsa',
        meioPagamento,
        descontoPercentual: parsePercentInput(descontoPercentual),
        jurosPercentual: parsePercentInput(jurosPercentual),
        multaPercentual: parsePercentInput(multaPercentual),
        mensagemBoleto: mensagemBoleto.trim(),
      });
      setGeneratedCobranca(cobranca);
      setStep(3);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Falha ao gerar cobrança.');
    }
  };

  const modalContent = (
    <div className="faturamento-modal-backdrop">
      <div className="faturamento-card faturamento-charge-modal">
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon">
              <ReceiptText size={20} />
            </span>
            <div>
              <h2>
                {step === 1 && 'Nova cobrança'}
                {step === 2 && 'Dados da cobrança'}
                {step === 3 && 'Cobrança gerada'}
              </h2>
              <p>Emissão avulsa com regras de boleto, Pix e link Asaas.</p>
            </div>
          </div>
          <button onClick={handleClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div className="faturamento-charge-choice">
            <button
              onClick={() => setTipo('cobranca')}
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
          </div>
        )}

        {step === 2 && (
          <div className="faturamento-charge-form">
            <BillingSectionTitle title="Dados principais" description="Cliente, valor e descrição da cobrança." />

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Parceiro / Cliente</label>
              <BillingClientSelect
                clientes={clientesQuery.data || []}
                value={clienteEmpresaId}
                onChange={setClienteEmpresaId}
                isLoading={clientesQuery.isLoading}
              />
            </div>

            <div className="faturamento-form-group">
              <label>Valor (R$)</label>
              <BillingInputFrame icon={
                <Banknote size={16} />
              }>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={valor}
                  onChange={(event) => setValor(formatCurrencyInput(event.target.value))}
                />
              </BillingInputFrame>
            </div>

            <div className="faturamento-form-group">
              <label>Data de vencimento</label>
              <BillingInputFrame icon={
                <CalendarDays size={16} />
              }>
                <input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} />
              </BillingInputFrame>
              {dataVencimento === getTodayString() && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontSize: '0.72rem', fontWeight: 600, marginTop: '4px' }}>
                  <AlertTriangle size={12} /> Vencimento hoje. Altere se necessário.
                </span>
              )}
            </div>

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descrição</label>
              <BillingInputFrame icon={
                <FileText size={16} />
              }>
                <input
                  type="text"
                  placeholder="Ex: Honorários contábeis, consultoria, regularização..."
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                />
              </BillingInputFrame>
            </div>

            <BillingSectionTitle title="Pagamento e regras do boleto" description="Configure desconto, juros e multa enviados para o Asaas." />

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Forma de Pagamento</label>
              <select value={meioPagamento} onChange={(event) => setMeioPagamento(event.target.value as 'Pix' | 'Boleto' | 'Ambos')}>
                <option value="Ambos">Boleto + Pix</option>
                <option value="Pix">Apenas Pix</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>

            <div className="faturamento-form-group">
              <label>Desconto até o vencimento (%)</label>
              <BillingInputFrame icon={
                <Percent size={16} />
              }>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={descontoPercentual}
                  onChange={(event) => setDescontoPercentual(formatPercentInput(event.target.value))}
                />
              </BillingInputFrame>
            </div>

            <div className="faturamento-form-group">
              <label>Juros ao mês (%)</label>
              <BillingInputFrame icon={
                <Percent size={16} />
              }>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={jurosPercentual}
                  onChange={(event) => setJurosPercentual(formatPercentInput(event.target.value))}
                />
              </BillingInputFrame>
            </div>

            <div className="faturamento-form-group">
              <label>Multa após vencimento (%)</label>
              <BillingInputFrame icon={
                <Percent size={16} />
              }>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={multaPercentual}
                  onChange={(event) => setMultaPercentual(formatPercentInput(event.target.value))}
                />
              </BillingInputFrame>
            </div>

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Mensagem no boleto</label>
              <textarea rows={2} maxLength={220} placeholder="Ex: Após o vencimento, cobrar juros e multa conforme contrato." value={mensagemBoleto} onChange={(event) => setMensagemBoleto(event.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && generatedCobranca && (
          <div className="faturamento-success-panel">
            <div className="faturamento-success-alert">
              <Check size={18} />
              <span>Cobrança criada no Asaas e registrada no financeiro.</span>
            </div>

            <div className="faturamento-success-summary">
              <div>
                <span>Cliente</span>
                <strong>{selectedCliente?.nome || 'Cliente selecionado'}</strong>
              </div>
              <div>
                <span>Valor</span>
                <strong>{formatCurrency(generatedCobranca.valor)}</strong>
              </div>
              <div>
                <span>Vencimento</span>
                <strong>{formatDate(generatedCobranca.dataVencimento)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{generatedCobranca.status}</strong>
              </div>
            </div>

            <div className="faturamento-form-group">
              <label>Link da página de cobrança</label>
              <div className="faturamento-link-row">
                <input readOnly value={paymentLink || 'O Asaas não retornou link de pagamento para esta cobrança.'} />
                <button type="button" onClick={() => copyToClipboard(paymentLink, 'Link copiado.')} disabled={!paymentLink} className="faturamento-icon-action" title="Copiar link">
                  <Clipboard size={16} />
                </button>
              </div>
            </div>

            {copyStatus && <div className="faturamento-copy-feedback">{copyStatus}</div>}

            <div className="faturamento-share-grid">
              <a href={paymentLink || undefined} target="_blank" rel="noreferrer" className={`faturamento-share-action ${!paymentLink ? 'disabled' : ''}`}>
                <ExternalLink size={16} /> Abrir cobrança
              </a>
              <a href={asaasPaymentLink || undefined} target="_blank" rel="noreferrer" className={`faturamento-share-action ${!asaasPaymentLink ? 'disabled' : ''}`}>
                <ExternalLink size={16} /> Abrir Asaas
              </a>
              <button type="button" onClick={() => void handleShare()} className="faturamento-share-action">
                <Share2 size={16} /> Compartilhar
              </button>
              <button type="button" onClick={() => void copyToClipboard(shareText, 'Mensagem copiada.')} className="faturamento-share-action">
                <Clipboard size={16} /> Copiar mensagem
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="faturamento-share-action">
                <MessageCircle size={16} /> Enviar WhatsApp
              </a>
            </div>
          </div>
        )}

        {errorMsg && <div className="faturamento-error-message">{errorMsg}</div>}

        <div className="faturamento-modal-actions">
          {step > 1 && step < 3 ? (
            <button onClick={() => setStep(step - 1)} className="faturamento-btn-secondary">
              <ArrowLeft size={16} /> Voltar
            </button>
          ) : <div />}

          {step === 3 ? (
            <div className="faturamento-actions-right">
              <button type="button" onClick={() => { resetForm(); setStep(2); }} className="faturamento-btn-secondary">
                <Plus size={16} /> Nova cobrança
              </button>
              <button type="button" onClick={handleClose} className="faturamento-btn-primary">
                Concluir
              </button>
            </div>
          ) : step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!tipo}
              className="faturamento-btn-primary"
              style={{ opacity: !tipo ? 0.5 : 1 }}
            >
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={createCobrancaMutation.isPending}
              className="faturamento-btn-primary"
            >
              <Check size={16} /> {createCobrancaMutation.isPending ? 'Gerando...' : 'Confirmar Geração'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
