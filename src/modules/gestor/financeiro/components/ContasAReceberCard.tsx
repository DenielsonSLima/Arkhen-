import React from 'react';
import type { CobrancaFinanceira } from '../services/financeiroService';

type ContasAReceberCardProps = {
  item: CobrancaFinanceira;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  getCompanyName: (companyId: string) => string;
  hoje: string;
  categoria?: string;
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

const isOverdue = (item: CobrancaFinanceira, hojeStr: string) => {
  return item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hojeStr));
};

const getStatusClass = (item: CobrancaFinanceira, hoje: string) => {
  const overdue = isOverdue(item, hoje);

  if (item.status === 'Cancelado') return 'status-cancelled';
  if (overdue) return 'status-overdue';
  if (item.status === 'Pago') return 'status-paid';
  return 'status-open';
};

export const ContasAReceberCard: React.FC<ContasAReceberCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
  getCompanyName,
  hoje,
  categoria,
}) => {
  const overdue = isOverdue(item, hoje);
  const statusLabel = statusToLabel(item.status);
  const statusClass = getStatusClass(item, hoje);
  const categoryLabel = categoria || 'Faturamento';

  return (
    <div className={`cobranca-card financeiro-card ${statusClass}`}>
      <div className={`cobranca-card-status-ribbon ${statusClass}`}>
        <span>Conta a receber</span>
      </div>
      <div className="cobranca-card-header">
        <div className="cobranca-card-client">
          <h4>{getCompanyName(item.clienteEmpresaId)}</h4>
          <span>{categoryLabel} • ID {item.id.toUpperCase()}</span>
        </div>
        <span
          className={`cobranca-badge ${overdue ? 'vencido' : item.status.toLowerCase()}`}
          title={`Situação: ${statusLabel}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="cobranca-card-body">
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Situação:</span>
            <strong>{overdue ? 'Em aberto (atrasada)' : statusLabel}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Vencimento:</span>
            <strong>{onFormatDate(item.dataVencimento)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Lançamento:</span>
            <strong>{onFormatDate(item.createdAt.slice(0, 10))}</strong>
          </div>
        </div>
      </div>
      <div className="financeiro-card-footer">
        <span>Identificador: {item.id}</span>
      </div>
    </div>
  );
};
