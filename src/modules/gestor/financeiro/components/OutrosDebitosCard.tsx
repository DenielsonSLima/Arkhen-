import React from 'react';

type OutrosDebitoItem = {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: 'Concluído' | 'Pendente';
};

type OutrosDebitosCardProps = {
  item: OutrosDebitoItem;
  onFormatCurrency: (value: number) => string;
  onFormatDate: (value: string) => string;
};

const statusClassName = (status: OutrosDebitoItem['status']) => {
  return status === 'Concluído' ? 'status-paid' : 'status-open';
};

const statusBadgeClass = (status: OutrosDebitoItem['status']) => {
  return status === 'Concluído' ? 'pago' : 'pendente';
};

export const OutrosDebitosCard: React.FC<OutrosDebitosCardProps> = ({
  item,
  onFormatCurrency,
  onFormatDate,
}) => {
  const statusClass = statusClassName(item.status);

  return (
    <div className={`cobranca-card financeiro-card ${statusClass}`}>
      <div className="cobranca-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
          <div className={`cobranca-card-status-ribbon ${statusClass}`}>
            Outros débitos
          </div>
          <div className="cobranca-card-client">
            <h4 title={item.descricao}>{item.descricao}</h4>
            <span title={`${item.categoria} • ID ${item.id.toUpperCase()}`}>{item.categoria} • ID {item.id.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div className="cobranca-card-body">
        <span className={`cobranca-badge ${statusBadgeClass(item.status)}`} style={{ alignSelf: 'flex-start' }}>
          {item.status}
        </span>
        <div className="financeiro-card-highlight">
          <span>{onFormatCurrency(item.valor)}</span>
        </div>
        <div className="financeiro-card-grid">
          <div className="financeiro-card-grid-row">
            <span>Lançamento</span>
            <strong>{onFormatDate(item.data)}</strong>
          </div>
          <div className="financeiro-card-grid-row">
            <span>Tipo</span>
            <strong>Saída</strong>
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
