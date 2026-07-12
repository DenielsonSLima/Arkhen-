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
      <div className="cobranca-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
          <div className={`cobranca-card-status-ribbon ${baseStatusClass}`}>
            Conta a pagar
          </div>
          <div className="cobranca-card-client">
            <h4 title={item.descricao}>{item.descricao}</h4>
            <span title={`${category} • ID ${item.id.toUpperCase()}`}>{category} • ID {item.id.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div className="cobranca-card-body">
        <span className={`cobranca-badge ${badgeStatusClass}`} style={{ alignSelf: 'flex-start' }}>
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
            <strong>{onFormatDate(item.dataLancamento)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Identificador</span>
            <strong title={item.id}>#{item.id.slice(0, 8).toUpperCase()}</strong>
          </div>
        </div>
      </div>
      <div className="financeiro-card-footer">
        <span title={item.id}>ID {item.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
};
