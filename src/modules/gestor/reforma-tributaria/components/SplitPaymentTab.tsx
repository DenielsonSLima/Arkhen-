import type { ReformaCliente } from '../services/reformaTributaria.types';
import { SplitPaymentForm } from '../forms/SplitPaymentForm';
import { ClienteSelector, EmptyState } from './ReformaShared';

interface Props { clientes: ReformaCliente[]; clienteId: string; onClientChange: (id: string) => void; }
export const SplitPaymentTab = ({ clientes, clienteId, onClientChange }: Props) => (
  <div className="rtc-tab-stack">
    <ClienteSelector clientes={clientes} value={clienteId} onChange={onClientChange} />
    {!clienteId ? <EmptyState title="Selecione um cliente" description="Projete a segregação do tributo e a necessidade adicional de capital de giro." /> : <SplitPaymentForm key={clienteId} clienteId={clienteId} />}
  </div>
);
