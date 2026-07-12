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
      <div className="cobranca-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
          <div className={`cobranca-card-status-ribbon ${baseStatusClass}`}>
            Transferência
          </div>
          <div className="cobranca-card-client">
            <h4 title={`Transferência #${item.id.toUpperCase()}`}>Transferência #{item.id.slice(0, 8).toUpperCase()}</h4>
            <span title={`${onFormatDate(item.data)} • ${item.bancoOrigem} → ${item.bancoDestino}`}>
              {item.bancoOrigem} → {item.bancoDestino}
            </span>
          </div>
        </div>
      </div>
      <div className="cobranca-card-body">
        <span className={`cobranca-badge ${statusBadge(status)}`} style={{ alignSelf: 'flex-start' }}>
          {status}
        </span>
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Origem</span>
            <strong title={item.origem}>{item.origem}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Destino</span>
            <strong title={item.destino}>{item.destino}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Data</span>
            <strong>{onFormatDate(item.data)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Referência</span>
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
