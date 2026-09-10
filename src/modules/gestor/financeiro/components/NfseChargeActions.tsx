import { Download, FileText, RefreshCw, Search } from 'lucide-react';
import { useNfseChargeActions } from '../hooks/useNfseChargeActions';
import type { CobrancaFinanceira } from '../services/financeiroService';

type Props = { charge: CobrancaFinanceira };
const actionStyle = { width: 'auto', gap: '5px', padding: '0 8px', fontSize: '0.72rem' };

export function NfseChargeActions({ charge }: Props) {
  const { feedback, isPending, canEmit, canConsult, canDownload, download, emit, consult } = useNfseChargeActions(charge);
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
        {canEmit && <button type="button" style={actionStyle} disabled={isPending} onClick={() => void emit()}
          title="Emite no ambiente fiscal configurado. RPS pendentes são consultados antes de um novo envio."
          aria-label={`Emitir ou reconciliar NFS-e da cobrança ${charge.id}`}>
          {isPending ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
          <span>{charge.nfseRpsNumero ? 'Reconciliar / emitir' : 'Emitir NFS-e'}</span>
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
    </div>
  );
}
