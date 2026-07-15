import type { ReformaCliente, ReformaStatus } from '../services/reformaTributaria.types';
import { STATUS_LABELS } from '../services/reformaPresentation';

export const ReformaStatusBadge = ({ status }: { status: ReformaStatus }) => (
  <span className={`rtc-status rtc-status-${status}`}>{STATUS_LABELS[status]}</span>
);

export const ClienteSelector = ({
  clientes,
  value,
  onChange,
  label = 'Empresa analisada',
}: {
  clientes: ReformaCliente[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) => (
  <label className="rtc-selector">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione um cliente</option>
      {clientes.map((cliente) => (
        <option key={cliente.id} value={cliente.id}>{cliente.nome} — {cliente.cnpj}</option>
      ))}
    </select>
  </label>
);

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rtc-empty"><strong>{title}</strong><p>{description}</p></div>
);
