import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle,
  Clipboard,
  CreditCard,
  Download,
  FileText,
  Info,
  Loader2,
  ReceiptText,
  Shield,
} from 'lucide-react';
import loginLogoImg from '../../../assets/camada-o.png';
import signatureLogoImg from '../../../assets/chatgpt-login.png';
import {
  copyTextToClipboard,
  fetchPublicCobranca,
  formatPublicCobrancaCurrency,
  formatPublicCobrancaDate,
  formatPublicCobrancaDocument,
  getPublicCobrancaIdFromPath,
  parsePublicCobrancaPayload,
} from './publicCobrancaHelpers';
import './PublicCobrancaPage.css';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export const PublicCobrancaPage = () => {
  const fallbackCobranca = useMemo(() => parsePublicCobrancaPayload(), []);
  const cobrancaId = useMemo(() => getPublicCobrancaIdFromPath(), []);
  const [cobranca, setCobranca] = useState(fallbackCobranca);
  const [isLoading, setIsLoading] = useState(Boolean(cobrancaId));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const showFeedback = (type: FeedbackState['type'], message: string, timeout = 2200) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), timeout);
  };

  useEffect(() => {
    document.title = cobranca ? `${cobranca.descricao} | Cobrança Arkhen` : 'Cobrança indisponível | Arkhen';
  }, [cobranca]);

  useEffect(() => {
    if (!cobrancaId) {
      setIsLoading(false);
      return undefined;
    }

    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchPublicCobranca(cobrancaId);
        if (mounted) setCobranca(data);
      } catch {
        if (mounted) setCobranca(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [cobrancaId, fallbackCobranca]);

  const copyText = async (content: string, message: string) => {
    try {
      await copyTextToClipboard(content);
      showFeedback('success', message);
    } catch {
      showFeedback('error', 'Não foi possível copiar automaticamente.', 3200);
    }
  };

  if (isLoading) {
    return (
      <main className="public-charge-unavailable">
        <div>
          <h1>Carregando cobrança</h1>
          <p><Loader2 size={17} className="animate-spin" /> Buscando dados atualizados da cobrança...</p>
        </div>
      </main>
    );
  }

  if (!cobranca) {
    return (
      <main className="public-charge-unavailable">
        <div>
          <h1>Acesso indisponível</h1>
          <p>Este link de cobrança não foi encontrado ou está incompleto. Solicite um novo link ao responsável.</p>
        </div>
      </main>
    );
  }

  const isExpired = Boolean(cobranca.isExpired || cobranca.status === 'Pago' || cobranca.status === 'Cancelado');

  if (isExpired) {
    const isPaid = cobranca.status === 'Pago';
    return (
      <main className="public-charge-unavailable">
        <div style={{ borderColor: isPaid ? '#10b981' : '#f59e0b' }}>
          <h1 style={{ color: isPaid ? '#10b981' : '#f59e0b' }}>
            {isPaid ? 'Cobrança Recebida' : 'Link Expirado'}
          </h1>
          <p>
            {isPaid 
              ? 'Esta cobrança já foi paga e o link de acesso seguro expirou.' 
              : 'Esta cobrança foi cancelada ou expirada e não está mais disponível.'}
          </p>
        </div>
      </main>
    );
  }

  const dueDate = formatPublicCobrancaDate(cobranca.dataVencimento);
  const amount = formatPublicCobrancaCurrency(cobranca.valor);
  const paymentLabel = cobranca.meioPagamento === 'Ambos' ? 'Boleto com Pix' : cobranca.meioPagamento;
  const serviceDescription = cobranca.servicoDescricao || cobranca.descricao || 'Serviço contratado';
  const emissorName = cobranca.emissorRazaoSocial || cobranca.emissorNome || 'Empresa emissora';
  const emissorCnpj = formatPublicCobrancaDocument(cobranca.emissorCnpj);
  const clienteCnpj = formatPublicCobrancaDocument(cobranca.clienteCnpj);

  return (
    <main className="public-charge-container">
      <header className="public-charge-site-header">
        <div className="public-charge-brand">
          <img src={loginLogoImg} alt="Logo Arkhen" />
          <div>
            <strong>Arkhen</strong>
            <span>Gestão Contábil</span>
          </div>
        </div>
        <div className="public-charge-secure">
          <Shield size={16} />
          <span>Cobrança segura</span>
        </div>
      </header>

      {feedback && (
        <div className={`public-charge-feedback ${feedback.type}`}>
          <CheckCircle size={16} />
          <span>{feedback.message}</span>
        </div>
      )}

      <section className="public-charge-content-area">
        <div className="public-charge-glass-modal animate-slide-up">
          <section className="public-charge-body-left">
            <div className="public-charge-document-heading">
              <div className="public-charge-file-icon">
                <FileText size={24} />
              </div>
              <div>
                <h1>{cobranca.descricao || 'Cobrança'}</h1>
                <span>{amount} • vence em {dueDate}</span>
              </div>
            </div>

            <div className="public-charge-preview-frame">
              {!isExpired && cobranca.bankSlipLink ? (
                <iframe title="Boleto da cobrança" src={cobranca.bankSlipLink} />
              ) : (
                <div className="public-charge-empty-preview">
                  <FileText size={38} />
                  <strong>{isExpired ? 'Link expirado' : 'Boleto ainda indisponível'}</strong>
                  <span>{isExpired ? cobranca.expiredReason || 'Esta cobrança não está mais disponível para pagamento.' : 'Use o botão para abrir o boleto do Banco Inter ou copie o Pix.'}</span>
                </div>
              )}
            </div>

            <div className="public-charge-safe-note">
              <Shield size={15} />
              <span>Esta cobrança foi compartilhada de forma segura. Não é necessário login para visualizar.</span>
            </div>
          </section>

          <aside className="public-charge-body-right">
            <div className="public-charge-sidebar-scroll">
              {isExpired && (
                <div className="public-charge-expired-box">
                  <CheckCircle size={18} />
                  <span>{cobranca.expiredReason || 'Esta cobrança já foi encerrada.'}</span>
                </div>
              )}

              <div className="public-charge-party-stack">
                <div className="public-charge-party-card emitter">
                  {cobranca.emissorLogoUrl ? (
                    <img src={cobranca.emissorLogoUrl} alt={emissorName} />
                  ) : (
                    <div className="public-charge-party-avatar">
                      <Building2 size={25} />
                    </div>
                  )}
                  <div>
                    <span>Empresa que cobrou</span>
                    <strong>{emissorName}</strong>
                    {cobranca.emissorNome && cobranca.emissorNome !== emissorName && <p>{cobranca.emissorNome}</p>}
                    <small>{emissorCnpj ? `CNPJ ${emissorCnpj}` : 'CNPJ não informado'}</small>
                  </div>
                </div>

                <div className="public-charge-party-card">
                  <div className="public-charge-party-avatar">
                    <Building2 size={25} />
                  </div>
                  <div>
                    <span>Empresa pagadora</span>
                    <strong>{cobranca.clienteNome}</strong>
                    {clienteCnpj && <small>CNPJ {clienteCnpj}</small>}
                    <div className="public-charge-client-tags">
                      {cobranca.clienteTipoEstabelecimento && <em>{cobranca.clienteTipoEstabelecimento}</em>}
                      {cobranca.clienteTipo && <em>{cobranca.clienteTipo}</em>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="public-charge-service-card">
                <span><ReceiptText size={17} /></span>
                <div>
                  <small>Descrição do serviço</small>
                  <strong>{serviceDescription}</strong>
                </div>
              </div>

              <div className="public-charge-info-grid">
                <div className="public-charge-info-row">
                  <span><Calendar size={18} /></span>
                  <div>
                    <small>Vencimento</small>
                    <strong>{dueDate}</strong>
                  </div>
                </div>
                <div className="public-charge-info-row">
                  <span><CreditCard size={18} /></span>
                  <div>
                    <small>Forma de pagamento</small>
                    <strong>{paymentLabel}</strong>
                  </div>
                </div>
                <div className="public-charge-info-row">
                  <span><Info size={18} /></span>
                  <div>
                    <small>Status</small>
                    <strong>{cobranca.status}</strong>
                  </div>
                </div>
                <div className="public-charge-info-row">
                  <span><FileText size={18} /></span>
                  <div>
                    <small>Valor</small>
                    <strong>{amount}</strong>
                  </div>
                </div>
              </div>

              {!isExpired && cobranca.pixCopyPaste && (
                <div className="public-charge-pix-box">
                  <div className="public-charge-pix-head">
                    <span>
                      <Clipboard size={16} />
                    </span>
                    <div>
                      <strong>Pix copia e cola</strong>
                      <small>Copie o código abaixo e cole no aplicativo do seu banco.</small>
                    </div>
                  </div>
                  <div>
                    <input readOnly value={cobranca.pixCopyPaste} />
                    <button type="button" onClick={() => void copyText(cobranca.pixCopyPaste || '', 'Pix copia e cola copiado.')}>
                      <Clipboard size={15} /> Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="public-charge-actions">
              <a href={isExpired ? undefined : (cobranca.bankSlipLink || cobranca.paymentLink)} target="_blank" rel="noreferrer" className={isExpired ? 'disabled' : ''}>
                <Download size={16} /> Baixar boleto
              </a>
            </div>
          </aside>
        </div>
      </section>

      <div className="public-charge-footer">© 2026 | Arkhen Gestão Contábil</div>
      <div className="public-charge-signature">
        <img src={signatureLogoImg} alt="Dailabs Logo" />
        <div>
          <strong>DAILABS</strong>
          <span>CREATIVE AI & SOFTWARES</span>
        </div>
      </div>
    </main>
  );
};
