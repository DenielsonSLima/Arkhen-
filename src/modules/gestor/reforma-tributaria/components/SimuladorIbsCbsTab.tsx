import type { ReformaCliente } from '../services/reformaTributaria.types';
import { SimulacaoIbsCbsForm } from '../forms/SimulacaoIbsCbsForm';
import { ClienteSelector, EmptyState } from './ReformaShared';

interface Props { clientes: ReformaCliente[]; clienteId: string; onClientChange: (id: string) => void; }
export const SimuladorIbsCbsTab = ({ clientes, clienteId, onClientChange }: Props) => {
  const eligibleClients = clientes.filter((cliente) => cliente.regime === 'Simples Nacional');
  const selectedId = eligibleClients.some((cliente) => cliente.id === clienteId) ? clienteId : '';
  return (
    <div className="rtc-tab-stack">
      <ClienteSelector clientes={eligibleClients} value={selectedId} onChange={onClientChange} label="Empresa optante pelo Simples" />
      {!selectedId ? <EmptyState title="Selecione uma empresa do Simples" description="Compare cenários paramétricos de IBS/CBS dentro e fora do regime unificado." /> : <SimulacaoIbsCbsForm key={selectedId} clienteId={selectedId} />}
    </div>
  );
};
