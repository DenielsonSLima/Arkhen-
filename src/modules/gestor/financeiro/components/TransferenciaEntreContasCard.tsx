import React from 'react';

type TransferenciaEntreContasItem = {
  id: string;
  data: string;
  bancoOrigem: string;
  origem: string;
  bancoDestino: string;
  destino: string;
  valor: number;
  status: 'Concluída' | 'Pendente';
};

type TransferenciaEntreContasCardProps = {
  item: TransferenciaEntreContasItem;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const statusClass = (status: TransferenciaEntreContasItem['status']) => {
  return status === 'Concluída' ? 'status-paid' : 'status-open';
};

const statusBadge = (status: TransferenciaEntreContasItem['status']) => {
  return status === 'Concluída' ? 'pago' : 'pendente';
};

export const TransferenciaEntreContasCard: React.FC<TransferenciaEntreContasCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
}) => {
  const status = item.status;
  const baseStatusClass = statusClass(status);

  return (
    <div className={`cobranca-card financeiro-card ${baseStatusClass}`}>
      <div className={`cobranca-card-status-ribbon ${baseStatusClass}`}>
        <span>Transferência</span>
      </div>
      <div className="cobranca-card-header">
        <div className="cobranca-card-client">
          <h4>Transferência #{item.id.toUpperCase()}</h4>
          <span>{onFormatDate(item.data)} • {item.bancoOrigem} → {item.bancoDestino}</span>
        </div>
        <span className={`cobranca-badge ${statusBadge(status)}`}>
          {status}
        </span>
      </div>
      <div className="cobranca-card-body">
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Conta origem:</span>
            <strong>{item.origem}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Conta destino:</span>
            <strong>{item.destino}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Data:</span>
            <strong>{onFormatDate(item.data)}</strong>
          </div>
        </div>
      </div>
      <div className="financeiro-card-footer">
        <span>ID: {item.id}</span>
      </div>
    </div>
  );
};
