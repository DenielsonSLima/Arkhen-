import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Shield,
  X,
} from 'lucide-react';
import type { CobrancaFinanceira } from '../../../financeiro/services/financeiroService';
import type { Company } from '../../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  buildCobrancaShareMessage,
  copyTextToClipboard,
  downloadCobrancaBankSlip,
  formatCobrancaCurrency,
  formatCobrancaDate,
  getCobrancaBankSlipLink,
  getCobrancaPaymentLink,
} from '../utils/cobrancaLinks';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';

interface CobrancaShareModalProps {
  cobranca: CobrancaFinanceira;
  cliente?: Company;
  onClose: () => void;
}

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export const CobrancaShareModal = ({ cobranca, cliente, onClose }: CobrancaShareModalProps) => {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const schedule = useManagedTimeout();
  const paymentLink = getCobrancaPaymentLink(cobranca);
  const bankSlipLink = getCobrancaBankSlipLink(cobranca);
  const shareMessage = useMemo(() => buildCobrancaShareMessage(cobranca, cliente), [cobranca, cliente]);
  const clienteNome = cliente?.razaoSocial || cliente?.nome || 'Cliente removido';

  const showFeedback = (type: FeedbackState['type'], message: string, timeout = 2000) => {
    setFeedback({ type, message });
    schedule(() => setFeedback(null), timeout);
  };

  const copyText = async (content: string, key: string, message: string) => {
    if (!content) return;
    try {
      await copyTextToClipboard(content);
      setCopiedKey(key);
      showFeedback('success', message);
      schedule(() => setCopiedKey(''), 1800);
    } catch {
      showFeedback('error', 'Não foi possível copiar automaticamente.', 3200);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cobrança Arkhen', text: shareMessage, url: paymentLink || undefined });
        return;
      } catch {
        // Cancelamento/indisponibilidade do compartilhamento nativo usa cópia.
      }
    }
    await copyText(shareMessage, 'message', 'Mensagem copiada para compartilhar.');
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadCobrancaBankSlip(cobranca);
      showFeedback('success', 'Boleto baixado.');
    } catch {
      showFeedback('error', 'O Asaas bloqueou o download direto. Use abrir em nova aba.', 3200);
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div className="faturamento-share-backdrop" onClick={onClose}>
      <div className="faturamento-share-modal" onClick={(event) => event.stopPropagation()}>
        <div className="faturamento-share-preview">
          <div className="faturamento-share-preview-title">
            <span className="faturamento-share-preview-icon">
              <FileText size={22} />
            </span>
            <div>
              <h2>{cobranca.descricao || 'Cobrança'}</h2>
              <span>{formatCobrancaCurrency(cobranca.valor)} • vence em {formatCobrancaDate(cobranca.dataVencimento)}</span>
            </div>
          </div>

          <div className="faturamento-share-document-frame">
            {bankSlipLink ? (
              <iframe title="Prévia do boleto" src={bankSlipLink} />
            ) : (
              <div className="faturamento-share-empty-preview">
                <FileText size={34} />
                <strong>Prévia indisponível</strong>
                <span>Esta cobrança ainda não retornou boleto para visualização.</span>
              </div>
            )}
          </div>

          <div className="faturamento-share-safe-note">
            <Shield size={15} />
            <span>Esta cobrança é compartilhada com link seguro. O pagamento acontece no ambiente Asaas.</span>
          </div>
        </div>

        <aside className="faturamento-share-sidebar">
          <div className="faturamento-share-sidebar-header">
            <div>
              <span>Compartilhar cobrança</span>
              <strong>{clienteNome}</strong>
              {cliente?.cnpj && <small>CNPJ {cliente.cnpj}</small>}
            </div>
            <button type="button" onClick={onClose} title="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="faturamento-share-info-grid">
            <div className="faturamento-share-info-row">
              <span><Calendar size={17} /></span>
              <div>
                <small>Vencimento</small>
                <strong>{formatCobrancaDate(cobranca.dataVencimento)}</strong>
              </div>
            </div>
            <div className="faturamento-share-info-row">
              <span><Shield size={17} /></span>
              <div>
                <small>Status</small>
                <strong>{cobranca.status}</strong>
              </div>
            </div>
          </div>

          <div className="faturamento-share-message-box">
            <label>Mensagem para envio</label>
            <textarea readOnly value={shareMessage} rows={8} />
          </div>

          {feedback && (
            <div className={`faturamento-share-feedback ${feedback.type}`}>
              {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="faturamento-share-actions">
            <button type="button" onClick={() => void copyText(shareMessage, 'message', 'Mensagem copiada.')}>
              {copiedKey === 'message' ? <CheckCircle size={16} /> : <Clipboard size={16} />}
              Copiar mensagem
            </button>
            <button type="button" onClick={() => void copyText(paymentLink, 'link', 'Link copiado.')} disabled={!paymentLink}>
              {copiedKey === 'link' ? <CheckCircle size={16} /> : <Clipboard size={16} />}
              Copiar link
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noreferrer" className={!paymentLink ? 'disabled' : ''}>
              <MessageCircle size={16} />
              WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent('Cobrança Arkhen')}&body=${encodeURIComponent(shareMessage)}`} className={!paymentLink ? 'disabled' : ''}>
              <Mail size={16} />
              E-mail
            </a>
            <button type="button" onClick={() => void handleDownload()} disabled={!bankSlipLink || isDownloading}>
              <Download size={16} />
              {isDownloading ? 'Baixando...' : 'Baixar boleto'}
            </button>
            <button type="button" onClick={() => void handleShare()} disabled={!paymentLink}>
              <ExternalLink size={16} />
              Compartilhar
            </button>
          </div>

          <button
            type="button"
            className="faturamento-share-open-button"
            onClick={() => window.open(paymentLink, '_blank', 'noopener,noreferrer')}
            disabled={!paymentLink}
          >
            <ExternalLink size={16} /> Abrir pagamento no Asaas
          </button>
        </aside>
      </div>
    </div>,
    document.body,
  );
};
