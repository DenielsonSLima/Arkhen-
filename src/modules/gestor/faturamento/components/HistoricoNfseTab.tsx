import { useState } from 'react';
import { useFiscalBillingHistory, useFiscalBillingTenant, useFiscalDraftMutations } from '../queries/useFaturamentoFiscalQueries';
import { faturamentoFiscalService } from '../services/faturamentoFiscalService';
import type { FiscalAmbiente, FiscalDraft } from '../services/faturamentoFiscalTypes';
import { NfseDraftForm } from '../forms/nfse/NfseDraftForm';

const labels: Record<string, string> = {
  rascunho: 'Rascunho', processando: 'Processando', rejeitada: 'Rejeitada', incerta: 'Resultado incerto',
  falha_pre_envio: 'Falha antes do envio', confirmada: 'Emitida', cancelada: 'Cancelada', substituida: 'Substituída',
};
export const HistoricoNfseTab = () => {
  const tenant = useFiscalBillingTenant();
  const [ambiente, setAmbiente] = useState<FiscalAmbiente | ''>('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState(''); const [appliedSearch, setAppliedSearch] = useState('');
  const notes = useFiscalBillingHistory(tenant.data || '', { ambiente: ambiente || undefined, status, search: appliedSearch });
  const actions = useFiscalDraftMutations();
  const [selected, setSelected] = useState<FiscalDraft>();
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [pendingId, setPendingId] = useState('');
  const execute = async (note: FiscalDraft, action: 'pdf' | 'xml' | 'consult') => {
    setError(''); setMessage(''); setPendingId(note.id);
    try {
      if (action === 'consult') {
        await actions.consult.mutateAsync(note);
        setMessage('Consulta do mesmo RPS concluída. Histórico atualizado; nenhuma nova emissão foi solicitada.');
      } else await faturamentoFiscalService.download(note, action);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação fiscal.'); }
    finally { setPendingId(''); }
  };
  return <div style={{ display: 'grid', gap: 20 }}>
    <p>Histórico fiscal WebISS. Situação de boleto ou Pix não determina o status da NFS-e.</p>
    <form className="faturamento-card nfse-fields" onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); }}>
      <label className="faturamento-form-group"><span>Buscar nota ou parceiro</span><input value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="faturamento-form-group"><span>Ambiente</span><select value={ambiente} onChange={e => setAmbiente(e.target.value as FiscalAmbiente | '')}>
        <option value="">Todos os ambientes</option><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></label>
      <label className="faturamento-form-group"><span>Status fiscal</span><select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Todos</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className="faturamento-btn-primary" disabled={notes.isFetching}>Filtrar</button>
    </form>
    {(tenant.isError || notes.isError || error) && <div role="alert" className="faturamento-error-message">{error || 'Não foi possível carregar o histórico fiscal.'}
      <button type="button" onClick={() => { void tenant.refetch(); void notes.refetch(); }} className="faturamento-btn-secondary">Tentar novamente</button></div>}
    {message && <p role="status">{message}</p>}
    <div className="faturamento-card faturamento-table-container"><table className="faturamento-table"><thead><tr>
      <th>NFS-e / RPS</th><th>Parceiro</th><th>Ambiente</th><th>Competência / emissão</th><th>Valor</th><th>Status fiscal</th><th>Ações</th>
    </tr></thead><tbody>
      {(notes.data || []).map(note => <tr key={`${note.origem}-${note.id}`}>
        <td>{note.numeroNfse || 'Ainda sem NFS-e'}<small style={{ display: 'block' }}>RPS: {note.rpsNumero || 'Não reservado'} {note.rpsSerie || ''}</small></td>
        <td>{note.parceiro || note.clienteId}</td><td>{note.ambiente === 'homologacao' ? 'Homologação — sem valor fiscal' : 'Produção'}</td>
        <td>{note.dados?.competencia || 'Não informada'}<small style={{ display: 'block' }}>{note.emissao || note.createdAt}</small></td>
        <td>{note.valor != null || note.dados?.valor ? Number(note.valor ?? note.dados.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado'}</td>
        <td>{labels[note.status] || note.status}{note.mensagem && <small style={{ display: 'block', maxWidth: 260 }}>{note.mensagem}</small>}</td>
        <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="faturamento-btn-secondary" disabled={!!pendingId} onClick={() => setSelected(note)}>
            {note.origem === 'rascunho' && ['rascunho', 'falha_pre_envio'].includes(note.status) ? 'Editar / revisar' : 'Detalhes'}</button>
          <button type="button" className="faturamento-btn-secondary" disabled={!!pendingId || !note.xmlDisponivel} onClick={() => void execute(note, 'pdf')}>PDF</button>
          <button type="button" className="faturamento-btn-secondary" disabled={!!pendingId || !note.xmlDisponivel} onClick={() => void execute(note, 'xml')}>XML</button>
          <button type="button" className="faturamento-btn-secondary" disabled={!!pendingId || !note.rpsNumero || !['rascunho', 'cobranca'].includes(note.origem || '')} onClick={() => void execute(note, 'consult')}>
            {pendingId === note.id ? 'Processando...' : 'Consultar RPS'}</button>
          <button type="button" disabled title="Cancelamento WebISS ainda não disponível no emissor" className="faturamento-btn-secondary">Cancelar indisponível</button>
        </div></td>
      </tr>)}
      {(tenant.isLoading || notes.isLoading) && <tr><td colSpan={7}>Carregando histórico fiscal...</td></tr>}
      {!notes.isLoading && !notes.isError && !tenant.isLoading && !tenant.isError && !notes.data?.length && <tr><td colSpan={7}>Nenhuma NFS-e ou rascunho encontrado neste filtro.</td></tr>}
    </tbody></table></div>
    {selected && <NfseDraftForm key={selected.id} initial={selected} onClose={() => setSelected(undefined)} />}
  </div>;
};
