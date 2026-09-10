import { Search, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { FiscalEmitter, FiscalHistoryFilters } from '../services/faturamentoFiscalTypes';
import { BillingClientSelect } from './billingFormUtils';
import { nfseStatusLabels } from '../utils/nfseHistoryPresentation';

interface Props {
  filters: FiscalHistoryFilters; search: string; emitters: FiscalEmitter[]; clients: Company[];
  loadingClients: boolean; busy: boolean; fetching: boolean; resetKey: number;
  onChange: (next: FiscalHistoryFilters) => void; onSearch: (value: string) => void;
  onFilter: () => void; onSync: () => void; onReset: () => void;
}
export function NfseHistoryFilters({ filters, search, emitters, clients, loadingClients, busy, fetching, resetKey,
  onChange, onSearch, onFilter, onSync, onReset }: Props) {
  const update = (next: Partial<FiscalHistoryFilters>) => onChange({ ...filters, ...next });
  const canSync = !!filters.fiscalConfigId && !!filters.clienteId && !!filters.ambiente && !!filters.dataInicial && !!filters.dataFinal;
  return <form className="faturamento-card nfse-history-filters" onSubmit={event => { event.preventDefault(); onFilter(); }}>
    <div className="nfse-history-filter-heading"><div><SlidersHorizontal size={18} /><h3>Consultar notas fiscais</h3></div>
      <button type="button" className="nfse-history-reset" onClick={onReset} disabled={busy}><X size={14} /> Limpar filtros</button></div>
    <div className="nfse-history-context-row">
      <div className="faturamento-form-group"><label htmlFor="nfse-history-emitter">Emitente</label>
        <select id="nfse-history-emitter" value={filters.fiscalConfigId || ''} disabled={busy} onChange={e => update({ fiscalConfigId: e.target.value || undefined })}>
          <option value="">Todos os emitentes</option>{emitters.map(item => <option key={item.id} value={item.id}>{item.prestadorNome} · {item.prestadorCnpj}</option>)}</select></div>
      <div className="faturamento-form-group nfse-history-partner"><label>Parceiro / tomador</label>
        <BillingClientSelect key={resetKey} clientes={clients} value={filters.clienteId || ''} onChange={value => update({ clienteId: value || undefined })}
          isLoading={loadingClients} disabled={busy} ariaLabel="Pesquisar parceiro / tomador" /></div>
      <div className="faturamento-form-group"><label htmlFor="nfse-history-environment">Ambiente</label>
        <select id="nfse-history-environment" value={filters.ambiente || ''} disabled={busy} onChange={e => update({ ambiente: e.target.value as FiscalHistoryFilters['ambiente'] || undefined })}>
          <option value="">Todos os ambientes</option><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></div>
    </div>
    <div className="nfse-history-search-row">
      <div className="faturamento-form-group nfse-history-search"><label htmlFor="nfse-history-search">Número da nota ou nome</label>
        <div><Search size={16} /><input id="nfse-history-search" placeholder="Buscar no histórico..." value={search} disabled={busy} onChange={e => onSearch(e.target.value)} /></div></div>
      <div className="faturamento-form-group"><label htmlFor="nfse-history-status">Status fiscal</label>
        <select id="nfse-history-status" value={filters.status || ''} disabled={busy} onChange={e => update({ status: e.target.value || undefined })}>
          <option value="">Todos</option>{Object.entries(nfseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="faturamento-form-group"><label htmlFor="nfse-history-start">Emissão de</label><input id="nfse-history-start" type="date" value={filters.dataInicial || ''} disabled={busy} onChange={e => update({ dataInicial: e.target.value || undefined })} /></div>
      <div className="faturamento-form-group"><label htmlFor="nfse-history-end">Emissão até</label><input id="nfse-history-end" type="date" value={filters.dataFinal || ''} disabled={busy} onChange={e => update({ dataFinal: e.target.value || undefined })} /></div>
      <button type="submit" className="faturamento-btn-secondary" disabled={busy || fetching}><Search size={16} /> Filtrar</button>
    </div>
    <div className="nfse-history-sync-row"><p>{canSync ? 'Consultar traz as notas deste parceiro e período para o histórico abaixo.' : 'Selecione emitente, parceiro, ambiente e período para consultar o WebISS.'} A consulta não emite notas.</p>
      <button type="button" className="faturamento-btn-primary" disabled={busy || !canSync} onClick={onSync}><RefreshCw size={16} className={busy ? 'nfse-history-spinning' : ''} />{busy ? 'Consultando WebISS...' : 'Consultar WebISS'}</button></div>
  </form>;
}
