import { useRef, useState } from 'react';
import { useConsultarNfseFinanceiraMutation, useEmitirNfseFinanceiraMutation } from '../queries/useFinanceiroQueries';
import type { CobrancaFinanceira } from '../services/financeiroService';
import type { NfseEmissionResult } from '../services/nfseService';

type Feedback = { success: boolean; message: string };

export function useNfseChargeActions(charge: CobrancaFinanceira) {
  const emission = useEmitirNfseFinanceiraMutation();
  const consultation = useConsultarNfseFinanceiraMutation();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmed, setConfirmed] = useState<NfseEmissionResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const running = useRef(false);
  const canEmit = charge.status !== 'Cancelado' && !charge.nfseId;
  const canConsult = Boolean(charge.nfseRpsNumero || charge.nfseId || charge.nfseStatus === 'processando' || charge.nfseStatus === 'pendente');
  const isPending = emission.isPending || consultation.isPending || downloading;

  const run = async (action: 'emit' | 'consult') => {
    if (running.current || (action === 'emit' ? !canEmit : !canConsult)) return;
    running.current = true;
    setFeedback(null);
    try {
      const result = action === 'emit'
        ? await emission.mutateAsync(charge.id)
        : await consultation.mutateAsync(charge.id);
      setConfirmed(result);
      setFeedback({ success: true, message: result.ambiente === 'homologacao'
        ? `NFS-e ${result.nfseId} em homologação — sem valor fiscal.`
        : `NFS-e ${result.nfseId} registrada em produção.` });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível concluir a operação fiscal.' });
    } finally { running.current = false; }
  };

  const documentResult = confirmed || (charge.nfseId ? { nfseId: charge.nfseId, ambiente: 'producao' as const } : null);
  const download = async () => {
    if (!documentResult || running.current || isPending) return;
    running.current = true; setDownloading(true); setFeedback(null);
    try {
      const { downloadNfseDocument } = await import('../services/nfseDocumentService');
      await downloadNfseDocument(charge.empresaId, charge.id, documentResult);
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível gerar o PDF da NFS-e.' });
    } finally { running.current = false; setDownloading(false); }
  };
  return { feedback, isPending, canEmit, canConsult, canDownload: Boolean(documentResult), download,
    emit: () => run('emit'), consult: () => run('consult') };
}
