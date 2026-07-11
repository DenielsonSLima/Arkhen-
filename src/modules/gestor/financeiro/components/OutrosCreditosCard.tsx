import React from 'react';

type OutrosCreditoItem = {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: 'Concluído' | 'Pendente';
};

type OutrosCreditosCardProps = {
  item: OutrosCreditoItem;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const statusClassName = (status: OutrosCreditoItem['status']) => {
  return status === 'Concluído' ? 'status-paid' : 'status-open';
};

const statusBadgeClass = (status: OutrosCreditoItem['status']) => {
  return status === 'Concluído' ? 'pago' : 'pendente';
};

export const OutrosCreditosCard: React.FC<OutrosCreditosCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
}) => {
  const statusClass = statusClassName(item.status);

  return (
    <div className={`cobranca-card financeiro-card ${statusClass}`}>
      <div className={`cobranca-card-status-ribbon ${statusClass}`}>
        <span>Outros créditos</span>
      </div>
      <div className="cobranca-card-header">
        <div className="cobranca-card-client">
          <h4>{item.descricao}</h4>
          <span>{item.categoria} • ID {item.id.toUpperCase()}</span>
        </div>
        <span className={`cobranca-badge ${statusBadgeClass(item.status)}`}>{item.status}</span>
      </div>
      <div className="cobranca-card-body">
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Data do lançamento:</span>
            <strong>{onFormatDate(item.data)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Tipo:</span>
            <strong>Entrada</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Referência:</span>
            <strong>{item.id}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
