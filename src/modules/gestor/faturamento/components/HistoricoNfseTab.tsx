import { useState } from 'react';
import { Eye, FileDown, FileCode2, RefreshCw, Edit3, XCircle } from 'lucide-react';
import { useFiscalBillingHistory, useFiscalBillingTenant, useFiscalDraftMutations, useFiscalEmitters } from '../queries/useFaturamentoFiscalQueries';
import { useFaturamentoClientesQuery } from '../queries/useFaturamentoQueries';
import { faturamentoFiscalService } from '../services/faturamentoFiscalService';
import type { FiscalDraft, FiscalHistoryFilters, FiscalSyncResult } from '../services/faturamentoFiscalTypes';
import { NfseDraftForm } from '../forms/nfse/NfseDraftForm';
import { NfseHistoryFilters } from './NfseHistoryFilters';
import { formatNfseCompetencia, formatNfseDate, nfseStatusLabels } from '../utils/nfseHistoryPresentation';
import './HistoricoNfseTab.css';

export const HistoricoNfseTab = () => {
  const tenant = useFiscalBillingTenant();
  const emitters = useFiscalEmitters(tenant.data || '');
  const clients = useFaturamentoClientesQuery(true);
  const [filters, setFilters] = useState<FiscalHistoryFilters>({});
  const [search, setSearch] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const invalidPeriod = Boolean(filters.dataInicial && filters.dataFinal && filters.dataInicial > filters.dataFinal);
  const notes = useFiscalBillingHistory(invalidPeriod ? '' : tenant.data || '', filters);
  const actions = useFiscalDraftMutations();
  const [selected, setSelected] = useState<FiscalDraft>();
  const [syncResult, setSyncResult] = useState<FiscalSyncResult>();
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [pendingId, setPendingId] = useState('');
  const busy = actions.sync.isPending || !!pendingId;
  const changeFilters = (next: FiscalHistoryFilters) => { setFilters(next); setMessage(''); setError(''); setSyncResult(undefined); };
  const synchronize = async () => {
    const { fiscalConfigId, clienteId, ambiente, dataInicial, dataFinal } = filters;
    setError(''); setMessage(''); setSyncResult(undefined);
    if (!fiscalConfigId || !clienteId || !ambiente || !dataInicial || !dataFinal) {
      setError('Selecione emitente, parceiro, ambiente e período para consultar o WebISS.'); return;
    }
    if (dataInicial > dataFinal) { setError('A data inicial deve ser anterior ou igual à data final.'); return; }
    setSearch(''); setFilters({ ...filters, status: undefined, search: undefined });
    try {
      const result = await actions.sync.mutateAsync({ scope: { fiscalConfigId, clienteId, ambiente, dataInicial, dataFinal }, inicio: dataInicial, fim: dataFinal });
      setSyncResult(result);
      setMessage(`${result.coverage === 'complete' ? 'Consulta concluída' : 'Consulta parcial'}: ${result.notesCount} nota(s) recebida(s) do WebISS de ${formatNfseDate(result.periodo.inicio)} a ${formatNfseDate(result.periodo.fim)}. O histórico deste parceiro foi atualizado. ${result.warning || ''}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o WebISS.'); }
  };
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
  return <div className="nfse-history">
    <p>Consulte e importe notas do WebISS aqui. O histórico mostra a situação fiscal, independente de boleto ou Pix.</p>
    <NfseHistoryFilters filters={filters} search={search} emitters={emitters.data || []} clients={clients.data || []}
      loadingClients={clients.isLoading} busy={busy} fetching={notes.isFetching} resetKey={resetKey}
      onChange={changeFilters} onSearch={setSearch} onFilter={() => changeFilters({ ...filters, search: search.trim() || undefined })}
      onSync={() => void synchronize()} onReset={() => { changeFilters({}); setSearch(''); setResetKey(key => key + 1); }} />
    {(invalidPeriod || tenant.isError || notes.isError || emitters.isError || clients.isError || error) && <div role="alert" className="nfse-history-feedback error">
      {invalidPeriod ? 'Período inválido: a data inicial deve ser anterior ou igual à data final. Ajuste as datas para filtrar ou consultar o WebISS.' : error || 'Não foi possível carregar o histórico, emitentes ou parceiros.'}{' '}
      {!invalidPeriod && <button type="button" onClick={() => { void tenant.refetch(); void notes.refetch(); void emitters.refetch(); void clients.refetch(); }} className="faturamento-btn-secondary">Tentar novamente</button>}</div>}
    {message && <p role="status" className={`nfse-history-feedback ${syncResult?.coverage === 'partial' ? 'partial' : ''}`}>{message}</p>}
    <div className="faturamento-card faturamento-table-container nfse-history-table-card"><table className="faturamento-table"><thead><tr>
      <th>NFS-e / RPS</th><th>Parceiro</th><th>Ambiente</th><th>Competência / emissão</th><th>Valor</th><th>Status fiscal</th><th>Ações</th>
    </tr></thead><tbody>
      {(notes.data || []).map(note => {
        const editable = note.origem === 'rascunho' && ['rascunho', 'falha_pre_envio'].includes(note.status);
        return <tr key={`${note.origem}-${note.id}`}>
          <td><strong>{note.numeroNfse || 'Ainda sem NFS-e'}</strong><small>RPS: {note.rpsNumero || 'Não reservado'} {note.rpsSerie || ''}</small></td>
          <td>{note.parceiro || note.clienteId}<small>{note.origem === 'consultada' ? 'Importada do WebISS' : 'Registrada no Arkhen'}</small></td>
          <td><span className={`nfse-history-environment ${note.ambiente}`}>{note.ambiente === 'homologacao' ? 'Homologação' : 'Produção'}</span>{note.ambiente === 'homologacao' && <small>Sem valor fiscal</small>}</td>
          <td>{formatNfseCompetencia(note.dados?.competencia)}<small>{note.emissao ? `Emitida em ${formatNfseDate(note.emissao)}` : 'Sem emissão confirmada'}</small></td>
          <td>{note.valor != null || note.dados?.valor ? Number(note.valor ?? note.dados.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado'}</td>
          <td><span className={`nfse-history-status ${note.status}`}>{nfseStatusLabels[note.status] || note.status}</span>{note.mensagem && <small>{note.mensagem}</small>}</td>
          <td><div className="nfse-history-actions">
            <button type="button" disabled={busy} onClick={() => setSelected(note)} title={editable ? 'Editar / revisar' : 'Detalhes'} aria-label={editable ? 'Editar / revisar' : 'Detalhes'}>{editable ? <Edit3 size={16} /> : <Eye size={16} />}</button>
            <button type="button" disabled={busy || !note.xmlDisponivel} onClick={() => void execute(note, 'pdf')} title="Baixar PDF" aria-label="PDF"><FileDown size={16} /></button>
            <button type="button" disabled={busy || !note.xmlDisponivel} onClick={() => void execute(note, 'xml')} title="Baixar XML" aria-label="XML"><FileCode2 size={16} /></button>
            <button type="button" disabled={busy || !note.rpsNumero || !['rascunho', 'cobranca'].includes(note.origem || '')} onClick={() => void execute(note, 'consult')} title="Consultar o mesmo RPS" aria-label="Consultar RPS"><RefreshCw size={16} className={pendingId === note.id ? 'nfse-history-spinning' : ''} /></button>
            <button type="button" disabled title="Cancelamento WebISS ainda não disponível no emissor" aria-label="Cancelar indisponível"><XCircle size={16} /></button>
          </div></td>
        </tr>;
      })}
      {(tenant.isLoading || notes.isLoading) && <tr><td colSpan={7} className="nfse-history-empty">Carregando histórico fiscal...</td></tr>}
      {!notes.isLoading && !notes.isError && !tenant.isLoading && !tenant.isError && !notes.data?.length && <tr><td colSpan={7} className="nfse-history-empty">Nenhuma nota neste filtro. Para buscar notas emitidas fora do Arkhen, selecione o contexto acima e consulte o WebISS.</td></tr>}
    </tbody></table></div>
    {selected && <NfseDraftForm key={selected.id} initial={selected} onClose={() => setSelected(undefined)} />}
  </div>;
};
