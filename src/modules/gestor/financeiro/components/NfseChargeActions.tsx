import { useEffect, useRef, useState } from 'react';
import { Download, FileText, RefreshCw, Search } from 'lucide-react';
import { NfseDraftForm } from '../../faturamento/forms/nfse/NfseDraftForm';
import { useNfseChargeActions } from '../hooks/useNfseChargeActions';
import type { CobrancaFinanceira } from '../services/financeiroService';
import { useFiscalChargeDraftLookup } from '../../faturamento/queries/useFaturamentoFiscalQueries';
import type { FiscalDraft } from '../../faturamento/services/faturamentoFiscalTypes';

type Props = { charge: CobrancaFinanceira };
const actionStyle = { width: 'auto', gap: '5px', padding: '0 8px', fontSize: '0.72rem' };

export function NfseChargeActions({ charge }: Props) {
  const { feedback, isPending: fiscalPending, canPrepareDraft, canConsult, canDownload, download, consult } = useNfseChargeActions(charge);
  const lookup = useFiscalChargeDraftLookup();
  const scope = JSON.stringify([charge.empresaId, charge.id, charge.clienteEmpresaId]);
  const scopeRef = useRef({ scope });
  if (scopeRef.current.scope !== scope) scopeRef.current = { scope };
  const [preparing, setPreparing] = useState<{ scope: string; initial?: FiscalDraft }>();
  const [prepareError, setPrepareError] = useState<{ scope: string; message: string }>();
  useEffect(() => { setPreparing(undefined); setPrepareError(undefined); }, [scope]);
  const isPending = fiscalPending || lookup.isPending;
  const prepare = async () => {
    if (isPending || !canPrepareDraft) return;
    const requestScope = scopeRef.current;
    setPrepareError(undefined);
    try {
      const initial = await lookup.mutateAsync({ cobrancaId: charge.id });
      if (scopeRef.current === requestScope) setPreparing({ scope, initial: initial || undefined });
    } catch (error) {
      if (scopeRef.current === requestScope) setPrepareError({ scope,
        message: error instanceof Error ? error.message : 'Não foi possível carregar o rascunho da cobrança.' });
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px', maxWidth: '300px' }}>
      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
        {charge.nfseId ? `NFS-e ${charge.nfseId}` : charge.nfseRpsNumero ? `RPS ${charge.nfseRpsNumero}` : 'Sem NFS-e de produção'}
      </span>
      <div className="faturamento-table-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {canDownload && <button type="button" style={actionStyle} disabled={isPending} onClick={() => void download()}
          aria-label={`Baixar PDF da NFS-e da cobrança ${charge.id}`} title="Monta o PDF com o XML confirmado e a marca d'água do prestador.">
          <Download size={14} /><span>PDF da NFS-e</span>
        </button>}
        {canPrepareDraft && <button type="button" style={actionStyle} disabled={isPending} onClick={() => void prepare()}
          title="Abre a preparação e revisão fiscal. Nenhum RPS é reservado ao abrir ou salvar o rascunho."
          aria-label={`Preparar NFS-e da cobrança ${charge.id}`}>
          {isPending ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
          <span>Emitir NFS-e</span>
        </button>}
        {canConsult && <button type="button" style={actionStyle} disabled={isPending} onClick={() => void consult()}
          title="Consulta ou reconcilia o RPS. Notas já confirmadas podem retornar o registro local."
          aria-label={`Consultar ou reconciliar RPS da cobrança ${charge.id}`}>
          <Search size={14} /><span>Consultar RPS</span>
        </button>}
      </div>
      {feedback && <p role={feedback.success ? 'status' : 'alert'}
        style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'normal', color: feedback.success ? '#15803d' : '#b91c1c' }}>
        {feedback.message}
      </p>}
      {prepareError?.scope === scope && <p role="alert" className="faturamento-error-message">{prepareError.message}</p>}
      {canPrepareDraft && preparing?.scope === scope && <NfseDraftForm key={scope} initial={preparing.initial}
        cobrancaId={charge.id} clienteId={charge.clienteEmpresaId} valor={charge.valor} descricao={charge.descricao}
        onClose={() => setPreparing(undefined)} />}
    </div>
  );
}
