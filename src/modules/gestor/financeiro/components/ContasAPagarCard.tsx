import React from 'react';

type ContasPagarItem = {
  id: string;
  descricao: string;
  categoria: string;
  dataVencimento: string;
  dataLancamento: string;
  valor: number;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
};

type ContasAPagarCardProps = {
  item: ContasPagarItem;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
  hoje: string;
  categoria?: string;
};

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const statusToLabel = (status: ContasPagarItem['status']) => {
  if (status === 'Pago') return 'Pago';
  if (status === 'Vencido') return 'Em atraso';
  if (status === 'Cancelado') return 'Cancelado';
  return 'Em aberto';
};

const statusClassName = (status: ContasPagarItem['status']) => {
  if (status === 'Pago') return 'status-paid';
  if (status === 'Vencido') return 'status-overdue';
  if (status === 'Cancelado') return 'status-cancelled';
  return 'status-open';
};

const isOverdue = (item: ContasPagarItem, hojeStr: string) => {
  return item.status === 'Vencido' || (item.status === 'Pendente' && toDate(item.dataVencimento) < toDate(hojeStr));
};

const badgeClass = (status: ContasPagarItem['status']) => {
  if (status === 'Pago') return 'pago';
  if (status === 'Cancelado') return 'cancelado';
  if (status === 'Vencido') return 'vencido';
  return 'pendente';
};

export const ContasAPagarCard: React.FC<ContasAPagarCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
  hoje,
  categoria,
}) => {
  const overdue = isOverdue(item, hoje);
  const baseStatusClass = overdue ? 'status-overdue' : statusClassName(item.status);
  const badgeStatusClass = overdue ? 'vencido' : badgeClass(item.status);
  const statusLabel = statusToLabel(item.status);
  const category = categoria || item.categoria || 'Despesas diversas';

  return (
    <div className={`cobranca-card financeiro-card ${baseStatusClass}`}>
      <div className={`cobranca-card-status-ribbon ${baseStatusClass}`}>
        <span>Conta a pagar</span>
      </div>
      <div className="cobranca-card-header">
        <div className="cobranca-card-client">
          <h4>{item.descricao}</h4>
          <span>{category} • ID {item.id.toUpperCase()}</span>
        </div>
        <span className={`cobranca-badge ${badgeStatusClass}`}>
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
            <strong>{onFormatDate(item.dataLancamento)}</strong>
          </div>
        </div>
      </div>
      <div className="financeiro-card-footer">
        <span>Identificador: {item.id}</span>
      </div>
    </div>
  );
};
