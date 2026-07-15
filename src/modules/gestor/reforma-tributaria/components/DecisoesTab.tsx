import { FileText, Printer, Scale } from 'lucide-react';
import { useReformaHistoricoQuery } from '../hooks/useReformaTributariaQueries';
import type { ReformaCliente } from '../services/reformaTributaria.types';
import { DecisaoForm } from '../forms/DecisaoForm';
import { ClienteSelector, EmptyState } from './ReformaShared';
import { formatDate } from '../services/reformaPresentation';

interface Props { clientes: ReformaCliente[]; clienteId: string; onClientChange: (id: string) => void; }
const DECISION_LABEL: Record<string, string> = { manter_simples: 'Manter no Simples', regime_regular: 'Regime regular', inconclusivo: 'Inconclusivo', pendente: 'Pendente' };

export const DecisoesTab = ({ clientes, clienteId, onClientChange }: Props) => {
  const historyQuery = useReformaHistoricoQuery(clienteId || null);
  return (
    <div className="rtc-tab-stack">
      <ClienteSelector clientes={clientes} value={clienteId} onChange={onClientChange} />
      {!clienteId ? <EmptyState title="Selecione um cliente" description="Formalize decisões e mantenha a memória das análises realizadas." /> : (
        <div className="rtc-two-columns">
          <section className="rtc-panel"><header className="rtc-panel-header"><div><span className="rtc-eyebrow">Governança tributária</span><h2>Novo registro de decisão</h2></div><Scale size={22} /></header><DecisaoForm key={clienteId} clienteId={clienteId} simulacoes={historyQuery.data?.simulacoes || []} /></section>
          <section className="rtc-panel rtc-report-panel">
            <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Trilha auditável</span><h2>Histórico e relatórios</h2></div><button type="button" className="rtc-secondary-button" onClick={() => window.print()}><Printer size={15} /> Imprimir</button></header>
            <div className="rtc-timeline">
              {(historyQuery.data?.decisoes || []).map((item) => <article key={item.id}><span><FileText size={15} /></span><div><strong>{DECISION_LABEL[item.decisao] || item.decisao}</strong><small>{formatDate(item.criadoEm)} · validade {formatDate(item.periodoInicio)} a {formatDate(item.periodoFim)}</small><p>{item.parecer || 'Sem parecer registrado.'}</p></div></article>)}
              {!historyQuery.isLoading && (historyQuery.data?.decisoes.length || 0) === 0 && <EmptyState title="Nenhuma decisão registrada" description="As versões anteriores nunca serão sobrescritas." />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
