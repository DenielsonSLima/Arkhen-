import { useEffect, useRef, useState } from 'react';
import { useFiscalDraftMutations, usePreviousFiscalNotes } from '../../queries/useFaturamentoFiscalQueries';
import type { FiscalDraft, FiscalPartnerScope, FiscalPreviousNote, FiscalSyncResult } from '../../services/faturamentoFiscalTypes';
export function PreviousFiscalNotes({ tenant, scope, competencia, onCopy, disabled = false, onBusyChange }: {
  tenant: string; scope: FiscalPartnerScope; competencia: string; onCopy: (draft: FiscalDraft) => void;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const notes = usePreviousFiscalNotes(tenant, scope);
  const actions = useFiscalDraftMutations();
  const [error, setError] = useState(''); const [syncResult, setSyncResult] = useState<FiscalSyncResult>();
  const busy = actions.sync.isPending || actions.copy.isPending;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(busy); return () => { onBusyChange?.(false); }; }, [busy, onBusyChange]);
  const synchronize = async () => {
    setError(''); setSyncResult(undefined);
    try { setSyncResult(await actions.sync.mutateAsync({ scope, inicio: scope.dataInicial, fim: scope.dataFinal })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o WebISS.'); }
  };
  const copy = async (note: FiscalPreviousNote) => {
    setError('');
    if (!competencia) { setError('Informe a competência da nova nota antes de copiar.'); return; }
    try { const draft = await actions.copy.mutateAsync({ scope, note, competencia }); if (active.current) onCopy(draft); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível copiar a nota.'); }
  };
  return <section className="nfse-previous" aria-label="Últimas notas do parceiro">
    <div className="nfse-toolbar"><h3>Até 5 notas anteriores deste parceiro</h3>
      <button type="button" className="faturamento-btn-secondary" disabled={disabled || busy || !scope.dataInicial || !scope.dataFinal} onClick={() => void synchronize()}>
        {actions.sync.isPending ? 'Consultando WebISS...' : 'Atualizar do WebISS'}
      </button></div>
    <p>Notas disponíveis no histórico local, dentro do período selecionado. Atualizar consulta o WebISS; não emite uma nota.</p>
    {syncResult && <p role="status">{syncResult.coverage === 'complete' ? 'Consulta concluída no período.' : 'Consulta parcial no período.'} {syncResult.notesCount} nota(s) retornada(s). {syncResult.warning}</p>}
    {(error || notes.isError) && <p role="alert">{error || (notes.error as Error).message}</p>}
    {notes.isLoading && <p>Carregando notas...</p>}
    {!notes.isLoading && !notes.isError && !notes.data?.length && <p>Nenhuma nota disponível neste contexto e período. Consulte o WebISS para buscar notas emitidas fora do Arkhen.</p>}
    {(notes.data || []).slice(0, 5).map(note => <article className="nfse-previous-note" key={`${note.origem}-${note.id}`}>
      <div><strong>NFS-e {note.numero}</strong> · {note.emissao} · {Number(note.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        <p>{note.dados.descricao || 'Descrição indisponível'}</p>
        <small>Fonte: {note.origem === 'consultada' ? 'WebISS consultado' : 'Emissão registrada no Arkhen'}{note.sincronizadoEm ? ` · Sincronizado em ${note.sincronizadoEm}` : ''}</small>
        {!!note.qualidade?.faltantes?.length && <p>Dados a completar: {note.qualidade.faltantes.join(', ')}</p>}
        {!!note.qualidade?.bloqueios?.length && <p role="alert">{note.qualidade.bloqueios.join(' · ')}</p>}
        {!!note.qualidade?.limitacoes?.length && <p>{note.qualidade.limitacoes.join(' · ')}</p>}
      </div>
      <button type="button" disabled={disabled || busy || !!note.qualidade?.bloqueios?.length} onClick={() => void copy(note)} className="faturamento-btn-secondary">Copiar dados</button>
    </article>)}
    <small>A cópia cria outro rascunho. Revise valor, competência e descrição; os identificadores da nota anterior não são reutilizados.</small>
  </section>;
}
