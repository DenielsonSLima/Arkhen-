import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  ExternalLink,
  MessageCircle,
  Plus,
  ReceiptText,
  Share2,
  X,
} from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  useCreateCobrancaFinanceiraMutation,
  useEmitirNfseFinanceiraMutation,
} from '../../financeiro/queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../../financeiro/services/financeiroService';
import {
  parseCurrencyInput,
  parsePercentInput,
} from './billingFormUtils';
import {
  LancamentoDetailsForm,
  LancamentoTypeChoice,
} from './NovoLancamentoAvulsoFormSteps';
import {
  DIRECT_NFSE_UNAVAILABLE_MESSAGE,
  executeNovoLancamento,
  getTodayString,
  type MeioPagamento,
  type NovoLancamentoTipo,
} from './novoLancamentoAvulsoModel';
import {
  buildCobrancaShareMessage,
  copyTextToClipboard,
  getCobrancaPaymentLink,
  getPublicCobrancaLink,
} from '../cobrancas/utils/cobrancaLinks';
import { useManagedTimeout } from '../hooks/useManagedTimeout';

interface ModalNovoLancamentoAvulsoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovoLancamentoAvulso: React.FC<ModalNovoLancamentoAvulsoProps> = ({ isOpen, onClose }) => {
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: isOpen,
  });
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
  const emitNfseMutation = useEmitirNfseFinanceiraMutation();
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<NovoLancamentoTipo>('cobranca');
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(getTodayString());
  const [descricao, setDescricao] = useState('');
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>('Ambos');
  const [descontoPercentual, setDescontoPercentual] = useState('');
  const [jurosPercentual, setJurosPercentual] = useState('');
  const [multaPercentual, setMultaPercentual] = useState('');
  const [mensagemBoleto, setMensagemBoleto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCobranca, setGeneratedCobranca] = useState<CobrancaFinanceira | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const schedule = useManagedTimeout();

  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value: string) => {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };
  const isSubmitPending = createCobrancaMutation.isPending || emitNfseMutation.isPending;
  const getSuccessMessage = () => {
    if (tipo === 'nfseComCobranca') return 'Cobrança criada no financeiro e NFS-e emitida com vínculo à cobrança.';
    return 'Cobrança criada no Banco Inter e registrada no financeiro.';
  };
  const getStep3Title = () => {
    if (tipo === 'nfseComCobranca') return 'Cobrança e NFS-e emitidas';
    return 'Cobrança gerada';
  };

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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCliente = (clientesQuery.data || []).find((cliente) => cliente.id === clienteEmpresaId);
  const bankPaymentLink = generatedCobranca ? getCobrancaPaymentLink(generatedCobranca) : '';
  const paymentLink = generatedCobranca ? getPublicCobrancaLink(generatedCobranca, selectedCliente) : '';
  const shareText = generatedCobranca ? buildCobrancaShareMessage(generatedCobranca, selectedCliente) : '';

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const copyToClipboard = async (content: string, message: string) => {
    if (!content) return;
    try {
      await copyTextToClipboard(content);
      setCopyStatus(message);
      schedule(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Não foi possível copiar automaticamente.');
      schedule(() => setCopyStatus(''), 2600);
    }
  };

  const handleShare = async () => {
    if (!shareText) return;
    if (navigator.share) {
      await navigator.share({ title: 'Cobrança Banco Inter', text: shareText, url: paymentLink || undefined });
      return;
    }
    await copyToClipboard(shareText, 'Mensagem copiada para compartilhar.');
  };

  const handleSubmit = async () => {
    if (tipo === 'nfse') {
      setErrorMsg(DIRECT_NFSE_UNAVAILABLE_MESSAGE);
      return;
    }

    const parsedValor = parseCurrencyInput(valor);
    if (!clienteEmpresaId) {
      setErrorMsg('Por favor, selecione um parceiro/cliente.');
      return;
    }
    if (parsedValor <= 0) {
      setErrorMsg('Por favor, insira um valor válido maior que zero.');
      return;
    }
    if (!dataVencimento) {
      setErrorMsg('Por favor, selecione a data de vencimento.');
      return;
    }

    try {
      setErrorMsg(null);
      const updatedCobranca = await executeNovoLancamento({
        tipo,
        createCobranca: () => createCobrancaMutation.mutateAsync({
          clienteEmpresaId,
          valor: parsedValor,
          dataVencimento,
          descricao: descricao.trim() || 'Cobrança avulsa',
          meioPagamento,
          descontoPercentual: parsePercentInput(descontoPercentual),
          jurosPercentual: parsePercentInput(jurosPercentual),
          multaPercentual: parsePercentInput(multaPercentual),
          mensagemBoleto: mensagemBoleto.trim(),
        }),
        emitNfse: (cobrancaId) => emitNfseMutation.mutateAsync(cobrancaId),
      });

      setGeneratedCobranca(updatedCobranca);
      setStep(3);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Falha ao gerar lançamento.');
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
                {step === 3 && getStep3Title()}
              </h2>
              <p>{step === 3 ? 'Lançamento finalizado.' : 'Toda NFS-e emitida por este fluxo precisa estar vinculada a uma cobrança no financeiro.'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        {step === 1 && <LancamentoTypeChoice tipo={tipo} onChange={setTipo} />}

        {step === 2 && (
          <LancamentoDetailsForm
            clientes={clientesQuery.data || []}
            isLoadingClientes={clientesQuery.isLoading}
            clienteEmpresaId={clienteEmpresaId}
            valor={valor}
            dataVencimento={dataVencimento}
            descricao={descricao}
            meioPagamento={meioPagamento}
            descontoPercentual={descontoPercentual}
            jurosPercentual={jurosPercentual}
            multaPercentual={multaPercentual}
            mensagemBoleto={mensagemBoleto}
            onClienteChange={setClienteEmpresaId}
            onValorChange={setValor}
            onDataVencimentoChange={setDataVencimento}
            onDescricaoChange={setDescricao}
            onMeioPagamentoChange={setMeioPagamento}
            onDescontoChange={setDescontoPercentual}
            onJurosChange={setJurosPercentual}
            onMultaChange={setMultaPercentual}
            onMensagemBoletoChange={setMensagemBoleto}
          />
        )}

        {step === 3 && generatedCobranca && (
          <div className="faturamento-success-panel">
            <div className="faturamento-success-alert">
              <Check size={18} />
              <span>{getSuccessMessage()}</span>
            </div>

            <div className="faturamento-success-summary">
              <div>
                <span>Cliente</span>
                <strong>{selectedCliente?.nome || 'Cliente selecionado'}</strong>
              </div>
              <div>
                <span>Valor original</span>
                <strong>{formatCurrency(generatedCobranca.valor)}</strong>
              </div>
              <div>
                <span>Vencimento</span>
                <strong>{formatDate(generatedCobranca.dataVencimento)}</strong>
              </div>

              {/* Discount row */}
              {parsePercentInput(descontoPercentual) > 0 && (
                <div>
                  <span>Com desconto (até o vencimento)</span>
                  <strong style={{ color: '#16a34a' }}>
                    {formatCurrency(generatedCobranca.valor * (1 - parsePercentInput(descontoPercentual)))}
                  </strong>
                </div>
              )}

              {/* Fine and interest row */}
              {(parsePercentInput(multaPercentual) > 0 || parsePercentInput(jurosPercentual) > 0) && (
                <div>
                  <span>Após o vencimento (valor + multa + juros/mês)</span>
                  <strong style={{ color: '#dc2626' }}>
                    {formatCurrency(
                      generatedCobranca.valor + 
                      (generatedCobranca.valor * parsePercentInput(multaPercentual)) + 
                      (generatedCobranca.valor * parsePercentInput(jurosPercentual))
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span>Status</span>
                <strong>{generatedCobranca.status}</strong>
              </div>
            </div>

            <div className="faturamento-form-group">
              <label>Link da página de cobrança</label>
              <div className="faturamento-link-row">
                <input readOnly value={paymentLink || 'O Banco Inter ainda está processando o documento desta cobrança.'} />
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
              <a href={bankPaymentLink || undefined} target="_blank" rel="noreferrer" className={`faturamento-share-action ${!bankPaymentLink ? 'disabled' : ''}`}>
                <ExternalLink size={16} /> Abrir boleto Inter
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
              disabled={isSubmitPending}
              className="faturamento-btn-primary"
            >
              <Check size={16} /> {isSubmitPending
                ? 'Gerando...'
                : tipo === 'nfseComCobranca'
                  ? 'Gerar cobrança e NFS-e'
                  : 'Gerar cobrança'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
