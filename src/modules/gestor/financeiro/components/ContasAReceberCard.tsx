import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clipboard, ExternalLink } from 'lucide-react';
import type { CobrancaFinanceira } from '../services/financeiroService';

type ContasAReceberCardProps = {
  item: CobrancaFinanceira;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  getCompanyName: (companyId: string) => string;
  companyDetails: { nome: string; cnpj: string };
  hoje: string;
  categoria?: string;
  onManualSettlement: (item: CobrancaFinanceira) => void;
  isManualSettlementLoading: boolean;
};

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const statusToLabel = (status: CobrancaFinanceira['status']) => {
  if (status === 'Pago') return 'Recebida';
  if (status === 'Vencido') return 'Em atraso';
  if (status === 'Cancelado') return 'Cancelada';
  return 'Em aberto';
};

const isOverdue = (item: CobrancaFinanceira, hojeStr: string) => (
  item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hojeStr))
);

const getStatusClass = (item: CobrancaFinanceira, hoje: string) => {
  const overdue = isOverdue(item, hoje);

  if (item.status === 'Cancelado') return 'status-cancelled';
  if (overdue) return 'status-overdue';
  if (item.status === 'Pago') return 'status-paid';
  return 'status-open';
};

const paymentLinkFor = (item: CobrancaFinanceira) => (
  item.asaasBankSlipUrl || item.asaasBoletoUrl || item.asaasInvoiceUrl || ''
);

export const ContasAReceberCard: React.FC<ContasAReceberCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
  getCompanyName,
  companyDetails,
  hoje,
  categoria,
  onManualSettlement,
  isManualSettlementLoading,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overdue = isOverdue(item, hoje);
  const statusLabel = statusToLabel(item.status);
  const statusClass = getStatusClass(item, hoje);
  const categoryLabel = categoria || item.categoria || 'Faturamento';
  const paymentLink = paymentLinkFor(item);
  const canSettle = item.bankProvider !== 'inter'
    && (item.status === 'Pendente' || item.status === 'Vencido' || overdue);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopy = async () => {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, 1600);
    } catch (error) {
      console.warn('[Financeiro] Não foi possível copiar o link de pagamento.', error);
    }
  };

  return (
    <div className={`cobranca-card financeiro-card ${statusClass}`}>
      <div className="cobranca-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
          <div className={`cobranca-card-status-ribbon ${statusClass}`}>
            Conta a receber
          </div>
          <div className="cobranca-card-client">
            <h4 title={getCompanyName(item.clienteEmpresaId)}>{getCompanyName(item.clienteEmpresaId)}</h4>
            <span title={`CNPJ ${companyDetails.cnpj || '-'} • ${categoryLabel}`}>
              CNPJ {companyDetails.cnpj || '-'} • {categoryLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="cobranca-card-body">
        <span className={`cobranca-badge ${overdue ? 'vencido' : item.status.toLowerCase()}`} style={{ alignSelf: 'flex-start' }}>
          {statusLabel}
        </span>
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Situação</span>
            <strong>{overdue ? 'Atrasada' : statusLabel}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Vencimento</span>
            <strong>{onFormatDate(item.dataVencimento)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Lançamento</span>
            <strong>{onFormatDate(item.createdAt.slice(0, 10))}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Serviço</span>
            <strong title={item.descricao}>{item.descricao || 'Faturamento'}</strong>
          </div>
        </div>
      </div>
      <div className="financeiro-card-footer financeiro-card-footer-actions">
        <span title={item.id}>ID {item.id.slice(0, 8).toUpperCase()}</span>
        <div className="financeiro-receber-actions">
          <button type="button" onClick={() => void handleCopy()} disabled={!paymentLink} title={copied ? 'Link copiado' : 'Copiar link'}>
            <Clipboard size={15} />
          </button>
          <a href={paymentLink || undefined} target="_blank" rel="noreferrer" className={!paymentLink ? 'disabled' : ''} title="Abrir pagamento">
            <ExternalLink size={15} />
          </a>
          {canSettle && (
            <button
              type="button"
              onClick={() => onManualSettlement(item)}
              disabled={isManualSettlementLoading}
              className="manual-settlement"
              title="Registrar recebimento de forma manual ou em partes"
            >
              <CheckCircle2 size={15} />
              <span>Baixa</span>
            </button>
          )}
          {item.bankProvider === 'inter' && (
            <button type="button" disabled title="Baixa manual do Banco Inter ainda não possui fluxo de cancelamento e conciliação">
              <CheckCircle2 size={15} />
              <span>Baixa indisponível</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
